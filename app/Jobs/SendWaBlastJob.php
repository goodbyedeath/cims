<?php

declare(strict_types=1);

namespace App\Jobs;

use App\Models\BlastFileLink;
use App\Models\CatalogSetting;
use App\Models\Channel;
use App\Models\WaBlacklist;
use App\Models\WaBlast;
use App\Models\WaBlastRecipient;
use App\Models\WaDevice;
use App\Services\SpintaxParser;
use App\Services\WhatsAppService;
use Illuminate\Support\Str;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\Middleware\WithoutOverlapping;
use Illuminate\Queue\SerializesModels;

/**
 * Sends ONE message per invocation, then re-dispatches itself with a delay for
 * the next recipient. Pacing lives in the queue (not a sleep), so no invocation
 * runs long enough for shared hosting to kill it mid-batch. The WithoutOverlapping
 * lock guarantees only one invocation per blast at a time — the hard stop against
 * duplicate/concurrent sends (the biggest ban risk).
 *
 * Phase 1: text only, Baileys gateway, immediate pacing (no drip window yet).
 */
class SendWaBlastJob implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    public int $timeout = 300; // one send — a few seconds; ceiling for safety
    public int $tries = 1;

    public function __construct(public int $blastId) {}

    /** @return array<int, object> */
    public function middleware(): array
    {
        return [(new WithoutOverlapping('wa-blast-'.$this->blastId))->dontRelease()->expireAfter(300)];
    }

    public function handle(): void
    {
        $blast = WaBlast::with('device')->find($this->blastId);
        if (! $blast || in_array($blast->status, ['completed', 'cancelled', 'failed'], true)) {
            return;
        }

        $device = $blast->device;
        if (! $device || ! $device->is_active) {   // device deleted or deactivated
            $this->stop($blast, 'failed');
            return;
        }

        if ($this->isCancelling($blast)) {
            $blast->recipients()->where('status', 'pending')->update(['status' => 'cancelled']);
            $this->stop($blast, 'cancelled');
            return;
        }

        if (! $this->deviceConnected($device)) {
            $this->pauseForDisconnect($blast);
            return;
        }

        // Drip: only send Mon–Sat inside the WIB window; otherwise park to a
        // future send-day.
        if ($blast->drip_enabled && (now('Asia/Jakarta')->isSunday() || ! $this->withinDripWindow())) {
            $this->scheduleNextDripDay($blast);
            return;
        }

        if ($blast->status !== 'sending') {
            $blast->update(['status' => 'sending', 'started_at' => $blast->started_at ?? now()]);
        }

        // Drip: roll today's budget once, then stop for the day when it's spent.
        if ($blast->drip_enabled) {
            $this->ensureDripDay($blast, $device);
            $blast->refresh();
            if ($blast->daily_sent_count >= (int) $blast->daily_target) {
                $this->scheduleNextDripDay($blast);
                return;
            }
        }

        $id = $blast->recipients()->where('status', 'pending')->inRandomOrder()->value('id');
        if ($id === null) {   // nothing left to send
            $this->stop($blast, ($blast->sent_count === 0 && $blast->failed_count > 0) ? 'failed' : 'completed');
            return;
        }

        $recipient = WaBlastRecipient::with('channel')->find($id);
        if (! $recipient || $recipient->status !== 'pending') {
            $this->dispatchNext($blast, 0);
            return;
        }

        $wa = app(WhatsAppService::class);

        if (WaBlacklist::where('phone', $wa->normalizePhone($recipient->phone))->exists()) {
            $recipient->update(['status' => 'skipped', 'error' => 'Blacklisted']);
            $this->dispatchNext($blast, 0);   // skip, no delay
            return;
        }

        // Build the text: {file} → placeholders → spintax (strict order —
        // spintax last, or it collapses unresolved {file}/{placeholder} groups).
        $text   = $this->resolveFileLink($blast, $recipient);
        $text   = $this->personalize($text, $recipient->channel);
        $text   = SpintaxParser::parse($text);
        $result = $this->sendOne($wa, $device, $blast, $recipient, $text);
        $success = (bool) ($result['success'] ?? false);

        // A disconnect mid-blast is not the recipient's failure — pause and retry
        // this same recipient once the number is back online.
        if (! $success && $this->isDisconnectError((string) ($result['error'] ?? ''))) {
            $this->pauseForDisconnect($blast);
            return;
        }

        $recipient->update([
            'status'  => $success ? 'sent' : 'failed',
            'error'   => $result['error'] ?? null,
            'sent_at' => $success ? now() : null,
        ]);
        $blast->increment($success ? 'sent_count' : 'failed_count');
        if ($success && $blast->drip_enabled) {
            $blast->increment('daily_sent_count');
        }
        $device->forceFill(['last_used_at' => now()])->save();

        if ($success) {
            if ((int) $blast->consecutive_fail > 0) {
                $blast->update(['consecutive_fail' => 0]);
            }
            if ($recipient->channel_id) {
                Channel::whereKey($recipient->channel_id)->update(['last_blasted_at' => now()]);
            }
            if ($blast->disconnect_started_at) {
                $blast->forceFill(['disconnect_started_at' => null])->save();
            }
        } else {
            $fails = (int) $blast->consecutive_fail + 1;
            $blast->update(['consecutive_fail' => $fails]);
            if ($fails >= 10) {   // 10 straight failures ⇒ number likely blocked
                $this->stop($blast, 'failed');
                return;
            }
        }

        $this->dispatchNext($blast, $this->throttleSeconds($blast));
    }

    /** Queue the next recipient after a pacing delay. */
    private function dispatchNext(WaBlast $blast, int $delaySeconds): void
    {
        self::dispatch($blast->id)->delay(now()->addSeconds(max(0, $delaySeconds)));
    }

    /** Anti-ban pacing: drip = 1–4 min; normal = 5–45 s, longer break every 30. */
    private function throttleSeconds(WaBlast $blast): int
    {
        if ($blast->drip_enabled) {
            return random_int(60, 240);
        }

        if ($blast->sent_count > 0 && $blast->sent_count % 30 === 0) {
            return random_int(180, 600);
        }

        return random_int(5, 45);
    }

    // ── Drip helpers (all keyed off settings, with sane defaults) ────────────

    private function setting(string $key, int $default): int
    {
        return (int) CatalogSetting::getValue($key, $default);
    }

    /** WIB working hour ∈ [start, end). */
    private function withinDripWindow(): bool
    {
        $h = now('Asia/Jakarta')->hour;

        return $h >= $this->setting('blast_drip_hour_start', 8)
            && $h < $this->setting('blast_drip_hour_end', 17);
    }

    /**
     * Roll today's send budget once per day. The range ramps by the device's
     * warm-up age (set on its first-ever drip send) so a fresh number starts
     * small and grows to the full daily min/max over the warm-up period.
     */
    private function ensureDripDay(WaBlast $blast, WaDevice $device): void
    {
        $today = now('Asia/Jakarta')->toDateString();
        if ($blast->daily_sent_date?->toDateString() === $today && (int) $blast->daily_target > 0) {
            return; // already rolled today
        }

        if (! $device->warmup_started_at) {
            $device->forceFill(['warmup_started_at' => now()])->save();
            $device->refresh();
        }

        [$lo, $hi] = $this->dailyRange($device);

        $blast->update([
            'daily_sent_date'  => $today,
            'daily_sent_count' => 0,
            'daily_target'     => random_int($lo, $hi),
            'send_day_index'   => (int) $blast->send_day_index + 1,
        ]);
    }

    /** @return array{0:int,1:int} [lo, hi] daily target range for the number's age. */
    private function dailyRange(WaDevice $device): array
    {
        $min        = $this->setting('blast_drip_daily_min', 12);
        $max        = $this->setting('blast_drip_daily_max', 35);
        $warmupDays = max(1, $this->setting('blast_drip_warmup_days', 3));

        // Day 1 (age 0) → factor 1/warmupDays; full strength after warmupDays.
        $age    = $device->warmup_started_at ? $device->warmup_started_at->diffInDays(now()) : 0;
        $factor = min(1.0, ($age + 1) / $warmupDays);

        $lo = (int) max(1, round($min * $factor));
        $hi = (int) max($lo, round($max * $factor));

        return [$lo, $hi];
    }

    /**
     * Park the blast until the next send-day: tomorrow (never Sunday, with a
     * ~rest_pct chance of one extra rest day), at a random time in the window.
     */
    private function scheduleNextDripDay(WaBlast $blast): void
    {
        $start   = $this->setting('blast_drip_hour_start', 8);
        $end     = $this->setting('blast_drip_hour_end', 17);
        $restPct = $this->setting('blast_drip_rest_pct', 25);

        $next = now('Asia/Jakarta')->addDay();
        if (random_int(1, 100) <= $restPct) {
            $next->addDay();
        }
        while ($next->isSunday()) {
            $next->addDay();
        }
        $next->setTime(random_int($start, max($start, $end - 1)), random_int(0, 59), 0);

        $blast->update([
            'status'       => 'scheduled',
            'scheduled_at' => $next->utc(),
        ]);
    }

    private function deviceConnected(WaDevice $device): bool
    {
        $r = app(WhatsAppService::class)->deviceInfo($device);

        return ($r['success'] ?? false)
            && strtolower((string) data_get($r, 'detail.data.status')) === 'connected';
    }

    private function isDisconnectError(string $error): bool
    {
        $e = strtolower($error);

        return str_contains($e, 'not connected')
            || str_contains($e, 'disconnect')
            || str_contains($e, 'device offline');
    }

    /**
     * Anchor the give-up clock to the START of the offline spell (never to the
     * blast start) — a resumed/multi-day blast must not fail on the first blip.
     */
    private function pauseForDisconnect(WaBlast $blast): void
    {
        if (! $blast->disconnect_started_at) {
            $blast->forceFill(['disconnect_started_at' => now()])->save();
            $blast->refresh();
        }

        $giveupHours = (int) CatalogSetting::getValue('blast_disconnect_giveup_hours', 12);
        if ($blast->disconnect_started_at && $blast->disconnect_started_at->diffInHours(now()) >= $giveupHours) {
            $this->stop($blast, 'failed');
            return;
        }

        // Park it; blasts:dispatch-scheduled re-queues it when due.
        $blast->update(['status' => 'scheduled', 'scheduled_at' => now()->addMinutes(5)]);
    }

    /** Dispatch the send by the blast's message type. Text is caption/address. */
    private function sendOne(WhatsAppService $wa, WaDevice $device, WaBlast $blast, WaBlastRecipient $recipient, string $text): array
    {
        return match ($blast->message_type ?? 'text') {
            'image'    => $wa->sendImageVia($device, $recipient->phone, (string) $blast->media_url, $text),
            'location' => $wa->sendLocationVia($device, $recipient->phone, (float) $blast->location_lat, (float) $blast->location_lng, $text),
            default    => $wa->sendVia($device, $recipient->phone, $text),
        };
    }

    /**
     * Replace {file} with this recipient's unique download URL (firstOrCreate so
     * a retry reuses the same link), or '' when the blast has no attachment.
     */
    private function resolveFileLink(WaBlast $blast, WaBlastRecipient $recipient): string
    {
        $message = (string) $blast->message;
        if (! str_contains($message, '{file}')) {
            return $message;
        }
        if (! $blast->blast_file_id) {
            return str_replace('{file}', '', $message);
        }

        $link = BlastFileLink::firstOrCreate(
            ['wa_blast_id' => $blast->id, 'blast_file_id' => $blast->blast_file_id, 'phone' => $recipient->phone],
            ['channel_id' => $recipient->channel_id, 'token' => Str::random(32)],
        );

        return str_replace('{file}', url('/file/'.$link->token), $message);
    }

    private function personalize(string $message, ?Channel $channel): string
    {
        if (! $channel) {
            return $message;
        }

        $greeting = $channel->gender === 'female' ? 'Ibu' : 'Bapak';
        $title    = $channel->gender === 'female' ? 'Bu' : 'Pak';

        return str_replace(
            ['{company_name}', '{owner_name}', '{channel_code}', '{owner_title}', '{owner_greeting}'],
            [$channel->company_name, $channel->owner_name ?? '', $channel->channel_code, "{$title} {$channel->owner_name}", $greeting],
            $message,
        );
    }

    private function stop(WaBlast $blast, string $status): void
    {
        $blast->update(['status' => $status, 'finished_at' => now()]);
    }

    private function isCancelling(WaBlast $blast): bool
    {
        return WaBlast::whereKey($blast->id)->value('status') === 'cancelling';
    }
}
