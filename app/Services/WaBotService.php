<?php

declare(strict_types=1);

namespace App\Services;

use App\Models\Channel;
use App\Models\WaBotRule;
use App\Models\WaInboundMessage;
use Illuminate\Support\Facades\Log;

class WaBotService
{
    public function __construct(private readonly WhatsAppService $wa) {}

    /**
     * Process one inbound WhatsApp message: match a keyword rule, log the hit,
     * and auto-reply. Messages that match no rule (personal chatter on the
     * paired number) are NOT stored — returns null for those.
     *
     * @param  array<string,mixed>  $raw  the raw webhook payload (for audit)
     */
    public function handleInbound(string $phone, string $message, array $raw = []): ?WaInboundMessage
    {
        $rule = $this->matchRule($message);

        if (! $rule) {
            return null; // nothing matched, no default — stay silent, keep no record
        }

        $channel = $this->matchChannel($phone);

        $inbound = WaInboundMessage::create([
            'phone'      => $phone,
            'channel_id' => $channel?->id,
            'message'    => $message,
            'raw'        => $raw ?: null,
        ]);

        $result = $this->reply($phone, $rule);

        $inbound->update([
            'matched_rule_id' => $rule->id,
            'reply_sent'      => $result['success'],
            'reply_text'      => $result['text'] ?? null,
            'reply_error'     => $result['success'] ? null : ($result['error'] ?? 'unknown'),
        ]);

        $rule->forceFill([
            'hit_count'   => $rule->hit_count + 1,
            'last_hit_at' => now(),
        ])->save();

        return $inbound->refresh();
    }

    /**
     * Pick the highest-priority active rule that matches. Real keyword rules
     * win over the catch-all 'default' rule regardless of priority.
     */
    public function matchRule(string $message): ?WaBotRule
    {
        $rules = WaBotRule::where('is_active', true)
            ->orderByDesc('priority')
            ->orderBy('id')
            ->get();

        $default = null;

        foreach ($rules as $rule) {
            if ($rule->match_type === 'default') {
                $default ??= $rule;
                continue;
            }
            if ($rule->matches($message)) {
                return $rule;
            }
        }

        return $default;
    }

    /**
     * @return array{success:bool, text?:string, error?:string}
     */
    private function reply(string $phone, WaBotRule $rule): array
    {
        if ($rule->reply_type === 'form' && $rule->wa_form_id) {
            $form = $rule->form;
            if (! $form || ! $form->is_active) {
                return ['success' => false, 'error' => 'linked form missing or inactive'];
            }
            $res = $this->wa->sendForm($phone, $form);

            return [
                'success' => (bool) $res['success'],
                'text'    => "[form] {$form->title}".(($res['mode'] ?? '') === 'fallback' ? ' (text menu)' : ''),
                'error'   => $res['error'] ?? null,
            ];
        }

        $text = (string) $rule->reply_message;
        if (trim($text) === '') {
            return ['success' => false, 'error' => 'empty reply message'];
        }

        $res = $this->wa->send($phone, $text);

        return [
            'success' => (bool) $res['success'],
            'text'    => $text,
            'error'   => $res['error'] ?? null,
        ];
    }

    /**
     * Best-effort: link an inbound number to a known channel by comparing the
     * last 9 digits (handles 08xx / 62xx / +62 format differences).
     */
    private function matchChannel(string $phone): ?Channel
    {
        $normalized = $this->wa->normalizePhone($phone);
        $suffix = substr(preg_replace('/\D/', '', $normalized), -9);
        if ($suffix === '' || strlen($suffix) < 7) {
            return null;
        }

        try {
            return Channel::whereRaw("RIGHT(REPLACE(REPLACE(REPLACE(phone,' ',''),'-',''),'+',''), 9) = ?", [$suffix])
                ->first();
        } catch (\Throwable $e) {
            Log::warning("WA channel match failed: {$e->getMessage()}");
            return null;
        }
    }
}
