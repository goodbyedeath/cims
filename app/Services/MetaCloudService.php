<?php

declare(strict_types=1);

namespace App\Services;

use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

/**
 * Outbound sender for the official Meta WhatsApp Business Cloud API
 * (graph.facebook.com). The Baileys/Wablas equivalent lives in WhatsAppService;
 * WhatsAppService::send() delegates here when WA_DRIVER=meta.
 *
 * Unlike the Baileys gateway there are no per-device tokens or QR — one WABA
 * phone number (phone_number_id) + a permanent access token send everything.
 */
class MetaCloudService
{
    public function isConfigured(): bool
    {
        return $this->phoneNumberId() !== '' && $this->accessToken() !== '';
    }

    private function phoneNumberId(): string
    {
        return (string) config('services.whatsapp_cloud.phone_number_id', '');
    }

    private function accessToken(): string
    {
        return (string) config('services.whatsapp_cloud.access_token', '');
    }

    private function baseUrl(): string
    {
        $version = (string) config('services.whatsapp_cloud.graph_version', 'v21.0');

        return "https://graph.facebook.com/{$version}";
    }

    /**
     * Send a plain text message. Returns the same shape as
     * WhatsAppService::send() so callers stay provider-blind:
     * ['success' => bool, 'error' => ?string, 'detail' => mixed].
     *
     * @return array{success:bool, error?:string, detail?:mixed}
     */
    public function sendText(string $phone, string $message): array
    {
        if (! $this->isConfigured()) {
            return ['success' => false, 'error' => 'Meta Cloud API belum dikonfigurasi (META_PHONE_NUMBER_ID / META_ACCESS_TOKEN).'];
        }

        try {
            $response = Http::withToken($this->accessToken())
                ->timeout(20)
                ->post("{$this->baseUrl()}/{$this->phoneNumberId()}/messages", [
                    'messaging_product' => 'whatsapp',
                    'recipient_type'    => 'individual',
                    'to'                => $phone,
                    'type'              => 'text',
                    'text'              => ['preview_url' => false, 'body' => $message],
                ]);

            $data = $response->json();

            // Success = 2xx and a message id came back.
            if ($response->successful() && ! empty($data['messages'][0]['id'])) {
                return ['success' => true, 'detail' => $data];
            }

            return [
                'success' => false,
                'error'   => $data['error']['message'] ?? ('HTTP ' . $response->status()),
                'detail'  => $data,
            ];
        } catch (\Throwable $e) {
            Log::error("Meta Cloud send failed [{$phone}]: {$e->getMessage()}");

            return ['success' => false, 'error' => $e->getMessage()];
        }
    }
}
