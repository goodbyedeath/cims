<?php

declare(strict_types=1);

namespace App\Http\Controllers;

use App\Services\WaBotService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;

class WaWebhookController extends Controller
{
    public function __construct(private readonly WaBotService $bot) {}

    /**
     * Inbound message webhook for the Wablas gateway.
     *
     * Configure in the Wablas dashboard:
     *   https://<your-domain>/wa/webhook/<WABLAS_SECRET>
     *
     * Public route (no session auth) — protected by the shared secret in the
     * path and CSRF-exempt (added in bootstrap/app.php).
     */
    public function handle(Request $request, string $secret): JsonResponse
    {
        $expected = (string) config('services.wablas.secret', '');

        if ($expected === '' || ! hash_equals($expected, $secret)) {
            return response()->json(['ok' => false], 403);
        }

        $payload = $request->all();
        // Wablas sometimes wraps the event under a "data" key.
        $data = isset($payload['data']) && is_array($payload['data']) ? $payload['data'] : $payload;

        // Ignore our own outgoing echoes and group chatter.
        $fromMe = (bool) ($data['fromMe'] ?? $data['from_me'] ?? false);
        $isGroup = (bool) ($data['isGroup'] ?? $data['is_group'] ?? false);
        if ($fromMe || $isGroup) {
            return response()->json(['ok' => true, 'skipped' => 'fromMe/group']);
        }

        $phone = (string) ($data['phone'] ?? $data['sender'] ?? $data['from'] ?? '');
        $message = (string) ($data['message'] ?? $data['text'] ?? $data['body'] ?? $data['messageText'] ?? '');

        // When the inbound is an interactive reply (button/list tap, product
        // order, or flow submission) the plain text may be empty — derive a
        // matchable string from the structured payload.
        if (trim($message) === '') {
            $message = $this->extractInteractive($data);
        }

        if (trim($phone) === '' || trim($message) === '') {
            return response()->json(['ok' => true, 'skipped' => 'empty']);
        }

        try {
            $this->bot->handleInbound($phone, $message, $payload);
        } catch (\Throwable $e) {
            Log::error("WA webhook handling failed: {$e->getMessage()}");
            // Still return 200 so Wablas doesn't hammer retries.
            return response()->json(['ok' => false, 'error' => 'internal']);
        }

        return response()->json(['ok' => true]);
    }

    /**
     * Derive a matchable text string from an interactive inbound payload —
     * Reply Button / List taps, Product orders, or Flow (nfm_reply) submissions.
     * Tolerant of the varying shapes different gateways use.
     *
     * @param  array<string,mixed>  $data
     */
    private function extractInteractive(array $data): string
    {
        $interactive = $data['interactive'] ?? [];

        // Reply Button tap
        $title = data_get($interactive, 'button_reply.title')
            ?? data_get($data, 'button_reply.title')
            ?? data_get($data, 'button.text');
        if ($title) {
            return (string) $title;
        }

        // List Message selection
        $title = data_get($interactive, 'list_reply.title')
            ?? data_get($data, 'list_reply.title');
        if ($title) {
            return (string) $title;
        }

        // Product order (single / multi product)
        $items = data_get($data, 'order.product_items') ?? data_get($interactive, 'order.product_items');
        if (is_array($items) && $items !== []) {
            $ids = array_filter(array_map(fn ($p) => $p['product_retailer_id'] ?? null, $items));
            return 'ORDER: '.implode(', ', $ids);
        }

        // Flow submission (nfm_reply carries the response JSON)
        $flow = data_get($interactive, 'nfm_reply.response_json')
            ?? data_get($data, 'nfm_reply.response_json');
        if ($flow) {
            return 'FLOW: '.(is_string($flow) ? $flow : json_encode($flow));
        }

        return '';
    }
}
