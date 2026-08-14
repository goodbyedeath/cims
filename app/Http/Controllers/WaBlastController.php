<?php

declare(strict_types=1);

namespace App\Http\Controllers;

use App\Jobs\SendWaBlastJob;
use App\Models\CatalogSetting;
use App\Models\Channel;
use App\Models\WaBlast;
use App\Models\WaBlastRecipient;
use App\Models\WaDevice;
use App\Services\WhatsAppService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Inertia\Inertia;
use Inertia\Response;

class WaBlastController extends Controller
{
    public function index(Request $request, WhatsAppService $wa): Response
    {
        $blasts = WaBlast::with('user:id,name')
            ->latest()
            ->paginate(15)
            ->withQueryString();

        $provinces = Channel::where('status', 'active')
            ->whereNotNull('phone')
            ->where('phone', '!=', '')
            ->distinct()
            ->pluck('province')
            ->filter()
            ->sort()
            ->values();

        return Inertia::render('WaBlast/Index', [
            'blasts' => $blasts,
            'provinces' => $provinces,
            'blastDevice' => $this->blastDeviceStatus($wa),
        ]);
    }

    /**
     * Live snapshot of the device that 'blast' traffic resolves to: connection
     * state and the gateway's per-device monthly send quota. Best-effort — a
     * down gateway yields reachable=false rather than throwing.
     *
     * @return array<string,mixed>
     */
    /**
     * The Baileys device a blast sends through: active blast-purpose → active
     * general → any active. Independent of the WA_DRIVER switch — blasts always
     * run over the self-hosted gateway (the anti-ban engine is Baileys-specific).
     */
    private function resolveBlastDevice(): ?WaDevice
    {
        return WaDevice::active()->where('purpose', 'blast')->first()
            ?? WaDevice::active()->where('purpose', 'general')->first()
            ?? WaDevice::active()->first();
    }

    private function blastDeviceStatus(WhatsAppService $wa): array
    {
        $device = $this->resolveBlastDevice();
        if (! $device) {
            return ['configured' => false];
        }

        $info = $wa->deviceInfo($device);
        $data = $info['success'] ? (array) data_get($info, 'detail.data', []) : [];
        $status = strtolower((string) ($data['status'] ?? ''));

        return [
            'configured'      => true,
            'name'            => $device->name,
            'reachable'       => (bool) $info['success'],
            'connected'       => $status === 'connected',
            'status'          => $status ?: 'unknown',
            'quota'           => $data['quota'] ?? null,
            'quota_used'      => $data['quota_used'] ?? null,
            'quota_remaining' => $data['quota_remaining'] ?? null,
            'quota_resets'    => $data['quota_resets'] ?? null,
        ];
    }

    public function preview(Request $request): JsonResponse
    {
        $request->validate([
            'target' => ['required', 'in:all,filtered,selected'],
            'filters' => ['nullable', 'array'],
            'filters.province' => ['nullable', 'string'],
            'filters.grade' => ['nullable', 'string'],
            'filters.status' => ['nullable', 'string'],
            'channel_ids' => ['nullable', 'array'],
            'channel_ids.*' => ['integer', 'exists:channels,id'],
        ]);

        $cooldownDays = (int) CatalogSetting::getValue('blast_cooldown_days', 14);
        $matched = (clone $this->buildChannelQuery($request))->count();

        $query = $this->buildChannelQuery($request)->blastable($cooldownDays);
        $channels = $query->get(['id', 'channel_code', 'company_name', 'phone', 'province', 'channel_grade']);

        return response()->json([
            'count' => $channels->count(),
            'cooldown_skipped' => max(0, $matched - $channels->count()),
            'cooldown_days' => $cooldownDays,
            'channels' => $channels,
        ]);
    }

    /**
     * Queue a blast: bind the sending device, materialise all recipients as
     * 'pending' (cooldown-filtered), and hand off to SendWaBlastJob — which
     * paces one message per queue invocation. No synchronous sending, so no
     * request timeout regardless of list size.
     */
    public function send(Request $request): RedirectResponse
    {
        $request->validate([
            'title' => ['required', 'string', 'max:100'],
            'message_type' => ['nullable', 'in:text,image,location'],
            // Text/caption/address; required for text, optional (caption) for image/location.
            'message' => [$request->input('message_type', 'text') === 'text' ? 'required' : 'nullable', 'string', 'max:5000'],
            'media_url' => ['nullable', 'required_if:message_type,image', 'url', 'max:2048'],
            'location_lat' => ['nullable', 'required_if:message_type,location', 'numeric', 'between:-90,90'],
            'location_lng' => ['nullable', 'required_if:message_type,location', 'numeric', 'between:-180,180'],
            'target' => ['required', 'in:all,filtered,selected'],
            'filters' => ['nullable', 'array'],
            'channel_ids' => ['nullable', 'array'],
            'drip_enabled' => ['boolean'],
            'scheduled_at' => ['nullable', 'date', 'after:now'],
            'blast_file_id' => ['nullable', 'integer', 'exists:blast_files,id'],
        ]);

        $device = $this->resolveBlastDevice();
        if (! $device) {
            return back()->with('error', 'Belum ada device WhatsApp aktif. Aktifkan device di halaman WA Devices dulu.');
        }

        // Per-device lock: don't run two blasts on the same number at once
        // (concurrent sends on one number is the biggest ban risk).
        $busy = WaBlast::where('device_id', $device->id)
            ->whereIn('status', ['queued', 'scheduled', 'sending', 'cancelling'])
            ->exists();
        if ($busy) {
            return back()->with('error', "Device \"{$device->name}\" masih menjalankan blast lain. Tunggu selesai atau hentikan dulu.");
        }

        $cooldownDays = (int) CatalogSetting::getValue('blast_cooldown_days', 14);
        $matched  = (clone $this->buildChannelQuery($request))->count();
        $channels = $this->buildChannelQuery($request)->blastable($cooldownDays)->get(['id', 'phone']);
        $skipped  = max(0, $matched - $channels->count());

        if ($channels->isEmpty()) {
            return back()->with('error', $skipped > 0
                ? "Semua {$matched} channel dilewati karena cooldown {$cooldownDays} hari terakhir."
                : 'Tidak ada channel aktif dengan nomor telepon.');
        }

        $drip      = (bool) $request->boolean('drip_enabled');
        $scheduled = $request->filled('scheduled_at') ? \Illuminate\Support\Carbon::parse($request->scheduled_at) : null;

        $blast = WaBlast::create([
            'user_id' => Auth::id(),
            'device_id' => $device->id,
            'blast_file_id' => $request->blast_file_id ?: null,
            'title' => $request->title,
            'message' => $request->message,
            'message_type' => $request->input('message_type', 'text'),
            'media_url' => $request->media_url,
            'location_lat' => $request->location_lat,
            'location_lng' => $request->location_lng,
            'total_recipients' => $channels->count(),
            'sent_count' => 0,
            'failed_count' => 0,
            // Scheduled-for-later or drip both start parked; dispatch-scheduled
            // (and the drip window logic) take it from there.
            'status' => $scheduled ? 'scheduled' : 'queued',
            'scheduled_at' => $scheduled,
            'drip_enabled' => $drip,
            'filters' => $request->filters,
        ]);

        // Bulk-insert pending recipients (personalisation happens at send time
        // from the live channel, so only channel_id + phone are stored here).
        $now = now();
        WaBlastRecipient::insert($channels->map(fn ($c) => [
            'wa_blast_id' => $blast->id,
            'channel_id'  => $c->id,
            'phone'       => $c->phone,
            'status'      => 'pending',
            'created_at'  => $now,
            'updated_at'  => $now,
        ])->all());

        // Kick it off now unless it's scheduled for a future time.
        if (! $scheduled) {
            SendWaBlastJob::dispatch($blast->id);
        }

        $mode = $drip ? 'mode drip (bertahap)' : 'antrean';
        $msg = $scheduled
            ? "Blast dijadwalkan {$scheduled->timezone('Asia/Jakarta')->format('d M Y H:i')} WIB untuk {$channels->count()} channel ({$mode})."
            : "Blast diantrikan untuk {$channels->count()} channel via \"{$device->name}\" ({$mode}). Kemajuan tampil di detail blast.";
        if ($skipped > 0) {
            $msg .= " {$skipped} dilewati (cooldown {$cooldownDays} hari).";
        }

        return back()->with('success', $msg);
    }

    /** Stop a running/queued blast — remaining recipients are cancelled. */
    public function cancel(WaBlast $waBlast): RedirectResponse
    {
        if (in_array($waBlast->status, ['completed', 'failed', 'cancelled'], true)) {
            return back()->with('error', 'Blast ini sudah selesai.');
        }

        if ($waBlast->status === 'sending') {
            // A live worker owns the loop — signal it to finalise cleanly.
            $waBlast->update(['status' => 'cancelling']);
        } else {
            // queued/scheduled/draft: no guaranteed live loop — cancel directly.
            $waBlast->recipients()->where('status', 'pending')->update(['status' => 'cancelled']);
            $waBlast->update(['status' => 'cancelled', 'finished_at' => now()]);
        }

        return back()->with('success', 'Blast dihentikan.');
    }

    /** Re-queue failed/cancelled recipients of a finished blast. */
    public function retry(WaBlast $waBlast): RedirectResponse
    {
        $device = $this->resolveBlastDevice();
        if (! $device) {
            return back()->with('error', 'Belum ada device WhatsApp aktif.');
        }

        $reopened = $waBlast->recipients()
            ->whereIn('status', ['failed', 'cancelled'])
            ->update(['status' => 'pending', 'error' => null, 'sent_at' => null]);

        $pending = $waBlast->recipients()->where('status', 'pending')->count();
        if ($pending === 0) {
            return back()->with('error', 'Tidak ada penerima gagal/dibatalkan untuk dikirim ulang.');
        }

        $waBlast->update([
            'device_id' => $device->id,
            'sent_count' => $waBlast->recipients()->where('status', 'sent')->count(),
            'failed_count' => 0,
            'consecutive_fail' => 0,
            'disconnect_started_at' => null,
            'scheduled_at' => null,
            'finished_at' => null,
            'status' => 'queued',
        ]);

        SendWaBlastJob::dispatch($waBlast->id);

        return back()->with('success', "Mengirim ulang {$reopened} penerima.");
    }

    public function show(WaBlast $waBlast): Response
    {
        $waBlast->load([
            'user:id,name',
            'device:id,name',
            'blastFile:id,original_name,expires_at,file_purged_at,download_count',
            'recipients.channel:id,channel_code,company_name',
        ]);

        // Attachment open-tracking: who has / hasn't opened their link.
        $fileTracking = null;
        if ($waBlast->blast_file_id) {
            $links = $waBlast->fileLinks()->with('channel:id,channel_code,company_name')->get();
            $fileTracking = [
                'total'    => $links->count(),
                'opened'   => $links->whereNotNull('downloaded_at')->count(),
                'openers'  => $links->map(fn ($l) => [
                    'phone'        => $l->phone,
                    'company'      => $l->channel?->company_name,
                    'channel_code' => $l->channel?->channel_code,
                    'opened'       => $l->downloaded_at !== null,
                    'opened_at'    => $l->downloaded_at?->toIso8601String(),
                    'count'        => $l->download_count,
                ])->values(),
            ];
        }

        return Inertia::render('WaBlast/Show', [
            'blast' => $waBlast,
            'fileTracking' => $fileTracking,
        ]);
    }

    /** Lightweight live progress poll for the Show page (JSON). */
    public function progress(WaBlast $waBlast): JsonResponse
    {
        return response()->json([
            'status'       => $waBlast->status,
            'sent_count'   => $waBlast->sent_count,
            'failed_count' => $waBlast->failed_count,
            'total'        => $waBlast->total_recipients,
            'pending'      => $waBlast->recipients()->where('status', 'pending')->count(),
            'scheduled_at' => $waBlast->scheduled_at?->toIso8601String(),
        ]);
    }

    public function destroy(WaBlast $waBlast): RedirectResponse
    {
        $waBlast->delete();

        return back()->with('success', 'Blast history deleted.');
    }

    private function buildChannelQuery(Request $request)
    {
        $query = Channel::where('status', 'active')
            ->whereNotNull('phone')
            ->where('phone', '!=', '');

        $target = $request->input('target', 'all');

        if ($target === 'selected' && $request->channel_ids) {
            $query->whereIn('id', $request->channel_ids);
        } elseif ($target === 'filtered') {
            $filters = $request->input('filters', []);
            if (!empty($filters['province'])) {
                $query->where('province', $filters['province']);
            }
            if (!empty($filters['grade'])) {
                $query->where('channel_grade', $filters['grade']);
            }
        }

        return $query;
    }
}
