<?php

declare(strict_types=1);

namespace App\Http\Controllers;

use App\Services\WaBotService;
use App\Services\WhatsAppService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Illuminate\Support\Facades\Log;

/**
 * Webhook endpoint for the OFFICIAL Meta WhatsApp Business Cloud API
 * (graph.facebook.com) — separate from the self-hosted Baileys gateway webhook
 * in WaWebhookController (which mimics Wablas).
 *
 * Meta docs: https://developers.facebook.com/docs/whatsapp/cloud-api/webhooks
 *
 * Config the Callback URL as https://componentsales.space/webhooks/whatsapp and
 * the Verify Token as WHATSAPP_CLOUD_VERIFY_TOKEN in the App Dashboard.
 */
class MetaWhatsAppWebhookController extends Controller
{
    /**
     * GET — endpoint verification. Meta sends hub.mode / hub.challenge /
     * hub.verify_token whenever the Callback URL or Verify Token is (re)saved.
     * Echo the challenge as plain text with 200 when the token matches.
     *
     * NB: PHP rewrites "." to "_" in query-string keys, so the params arrive as
     * hub_mode / hub_challenge / hub_verify_token — not hub.mode etc.
     */
    public function verify(Request $request): Response
    {
        $mode      = (string) $request->query('hub_mode', '');
        $token     = (string) $request->query('hub_verify_token', '');
        $challenge = (string) $request->query('hub_challenge', '');

        $expected = (string) config('services.whatsapp_cloud.verify_token', '');

        if ($mode === 'subscribe' && $expected !== '' && hash_equals($expected, $token)) {
            // Must be the raw challenge string, not JSON.
            return response($challenge, 200)->header('Content-Type', 'text/plain');
        }

        Log::warning('Meta WA webhook verification failed', ['mode' => $mode, 'token_ok' => hash_equals($expected, $token)]);

        return response('Forbidden', 403);
    }

    /**
     * POST — event delivery. Validate the X-Hub-Signature-256 HMAC (raw body
     * keyed by the app secret), capture the payload, and always answer 200 for
     * a valid request so Meta doesn't retry for 7 days.
     */
    public function handle(Request $request, WaBotService $bot, WhatsAppService $wa): JsonResponse
    {
        $raw    = $request->getContent();
        $secret = (string) config('services.whatsapp_cloud.app_secret', '');

        // Signature is enforced whenever the app secret is configured. Meta
        // signs the EXACT raw bytes — never re-encode the JSON before hashing.
        if ($secret !== '') {
            $provided = (string) $request->header('X-Hub-Signature-256', '');
            $expected = 'sha256=' . hash_hmac('sha256', $raw, $secret);

            if ($provided === '' || ! hash_equals($expected, $provided)) {
                Log::warning('Meta WA webhook: invalid signature');

                return response()->json(['error' => 'invalid signature'], 403);
            }
        } else {
            // Test mode before the secret is wired up — accept but flag it.
            Log::warning('Meta WA webhook: META_APP_SECRET not set — accepting POST without signature check');
        }

        $payload = $request->json()->all();

        // Only drive the chatbot when Meta is the active WA driver — otherwise
        // the bot's reply (WhatsAppService::send) would go out the Baileys
        // number, not the Meta number that received the message.
        $botActive = $wa->driver() === 'meta';

        foreach ($this->extractMessages($payload) as $msg) {
            if ($botActive && $msg['type'] === 'text' && $msg['from'] !== '' && ($msg['text'] ?? '') !== '') {
                try {
                    $bot->handleInbound($msg['from'], (string) $msg['text'], $payload);
                } catch (\Throwable $e) {
                    Log::error("Meta WA bot handling failed: {$e->getMessage()}");
                }
            }
        }

        return response()->json(['ok' => true]);
    }

    /**
     * Flatten a Cloud API payload down to inbound messages:
     * entry[].changes[].value.messages[]. Status callbacks (sent/delivered/read)
     * live under value.statuses[] and are skipped here.
     *
     * @param  array<string,mixed>  $payload
     * @return list<array{from:string,type:string,text:?string,id:?string}>
     */
    private function extractMessages(array $payload): array
    {
        $out = [];

        foreach ($payload['entry'] ?? [] as $entry) {
            foreach ($entry['changes'] ?? [] as $change) {
                foreach ($change['value']['messages'] ?? [] as $m) {
                    $out[] = [
                        'from' => (string) ($m['from'] ?? ''),
                        'type' => (string) ($m['type'] ?? ''),
                        'text' => $m['text']['body'] ?? null,
                        'id'   => $m['id'] ?? null,
                    ];
                }
            }
        }

        return $out;
    }
}
