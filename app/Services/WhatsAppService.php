<?php

declare(strict_types=1);

namespace App\Services;

use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

class WhatsAppService
{
    private string $url;
    private string $token;

    public function __construct()
    {
        $this->url = rtrim(config('services.wablas.url', 'https://jkt.wablas.com'), '/');
        $this->token = config('services.wablas.token', '');
    }

    public function send(string $phone, string $message): array
    {
        if (empty($this->token)) {
            return ['success' => false, 'error' => 'Wablas token not configured'];
        }

        $phone = $this->normalizePhone($phone);

        try {
            $response = Http::withHeaders([
                'Authorization' => $this->token,
            ])->post("{$this->url}/api/send-message", [
                'phone' => $phone,
                'message' => $message,
            ]);

            $data = $response->json();

            if ($response->successful() && ($data['status'] ?? false) === true) {
                return ['success' => true, 'detail' => $data];
            }

            return [
                'success' => false,
                'error' => $data['message'] ?? $data['error'] ?? 'Unknown error',
            ];
        } catch (\Throwable $e) {
            Log::error("WhatsApp send failed [{$phone}]: {$e->getMessage()}");
            return ['success' => false, 'error' => $e->getMessage()];
        }
    }

    private function normalizePhone(string $phone): string
    {
        // Remove spaces, dashes, parentheses
        $phone = preg_replace('/[\s\-\(\)]+/', '', $phone);

        // Convert 08xx to 628xx
        if (str_starts_with($phone, '08')) {
            $phone = '62' . substr($phone, 1);
        }

        // Remove leading +
        $phone = ltrim($phone, '+');

        return $phone;
    }
}
