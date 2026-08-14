<?php

declare(strict_types=1);

namespace App\Services;

use App\Models\CatalogSetting;
use App\Models\WaDevice;
use App\Models\WaForm;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

class WhatsAppService
{
    private string $url;
    private string $token;
    private string $secret;
    private bool $interactive;

    /** Resolved [url, token, secret] per purpose, so each request queries once. */
    private array $credsCache = [];

    /** Cached active driver, so a blast loop doesn't re-query per message. */
    private ?string $driverCache = null;

    public function __construct()
    {
        // Default (general) credentials back the legacy $url/$token/$secret
        // properties used by interactive sends and device management.
        [$this->url, $this->token, $this->secret] = $this->credsFor('general');
        $this->interactive = (bool) config('services.wablas.interactive', false);
    }

    /**
     * Credentials for a traffic purpose. Devices can be dedicated per purpose
     * ('otp' for verification/transactional, 'blast' for bulk) so heavy blast
     * traffic can't get the transactional number banned. Fallback chain:
     * active device with this purpose → active 'general' device → any active
     * device → .env values.
     */
    private function credsFor(string $purpose): array
    {
        if (isset($this->credsCache[$purpose])) {
            return $this->credsCache[$purpose];
        }

        $device = null;

        try {
            $device = WaDevice::active()->where('purpose', $purpose)->first()
                ?? WaDevice::active()->where('purpose', 'general')->first()
                ?? WaDevice::active()->first();
        } catch (\Throwable) {
            // Table may not exist yet (fresh install, mid-migration) — fall back.
        }

        $creds = $device !== null
            ? [$device->serverUrl(), (string) $device->token, (string) ($device->secret_key ?? '')]
            : [
                rtrim(config('services.wablas.url', 'https://jkt.wablas.com'), '/'),
                config('services.wablas.token', '') ?? '',
                (string) config('services.wablas.secret', ''),
            ];

        return $this->credsCache[$purpose] = $creds;
    }

    /**
     * Active WA driver: 'meta' (official Cloud API) or 'baileys' (self-hosted
     * gateway). Governs the outbound send path; device/QR management is
     * Baileys-only and inert under 'meta'. Source of truth is the `wa_driver`
     * setting (toggled from the WA Devices page); WA_DRIVER in .env is the
     * default when the setting is unset.
     */
    public function driver(): string
    {
        if ($this->driverCache !== null) {
            return $this->driverCache;
        }

        $value = CatalogSetting::getValue('wa_driver', config('services.wa.driver', 'baileys'));

        return $this->driverCache = ($value === 'meta' ? 'meta' : 'baileys');
    }

    /**
     * The WaDevice that traffic of this purpose resolves to (same fallback
     * chain as credsFor), or null when only the .env credentials back it —
     * lets callers read live status/quota for the device actually in use.
     * Always null under the Meta driver (there are no devices there).
     */
    public function deviceFor(string $purpose): ?WaDevice
    {
        if ($this->driver() === 'meta') {
            return null;
        }

        try {
            return WaDevice::active()->where('purpose', $purpose)->first()
                ?? WaDevice::active()->where('purpose', 'general')->first()
                ?? WaDevice::active()->first();
        } catch (\Throwable) {
            return null;
        }
    }

    public function isConfigured(): bool
    {
        if ($this->driver() === 'meta') {
            return app(MetaCloudService::class)->isConfigured();
        }

        return $this->token !== '';
    }

    public function send(string $phone, string $message, string $purpose = 'general'): array
    {
        // Meta Cloud API path — one WABA number, no per-device tokens.
        if ($this->driver() === 'meta') {
            return app(MetaCloudService::class)->sendText($this->normalizePhone($phone), $message);
        }

        [$url, $token] = $this->credsFor($purpose);

        if (empty($token)) {
            return ['success' => false, 'error' => 'Wablas token not configured'];
        }

        $phone = $this->normalizePhone($phone);

        try {
            // Bound the wait — the self-hosted gateway can hang for seconds; an
            // unbounded send would tie up the queue worker driving a blast.
            $response = Http::withHeaders([
                'Authorization' => $token,
            ])->timeout(30)->post("{$url}/api/send-message", [
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

    /**
     * Send a WhatsApp "form" (interactive button / list message).
     *
     * Tries a native interactive message when WABLAS_INTERACTIVE=true and the
     * plan supports it; on any failure — or by default — it falls back to a
     * plain numbered text menu, which works on every WhatsApp account. The
     * keyword chatbot matches the digit/text the recipient replies with either way.
     *
     * @return array{success:bool, mode:string, error?:string, detail?:mixed}
     */
    public function sendForm(string $phone, WaForm $form): array
    {
        if ($this->interactive) {
            $native = $this->sendInteractive($phone, $form);
            if ($native['success']) {
                return $native + ['mode' => 'native'];
            }
            Log::warning("WA interactive send failed, falling back to text menu: {$native['error']}");
        }

        $res = $this->send($phone, $form->toTextMenu());

        return $res + ['mode' => 'fallback'];
    }

    /**
     * Native interactive message — Reply Buttons, List, Single/Multi-Product, or
     * Flow. Sends the WhatsApp Cloud-API "interactive" object (which gateways
     * proxy) to a configurable endpoint. Guarded by config and always has a
     * text-menu fallback, since the exact endpoint varies per Wablas plan.
     */
    private function sendInteractive(string $phone, WaForm $form): array
    {
        if (empty($this->token)) {
            return ['success' => false, 'error' => 'Wablas token not configured'];
        }

        $interactive = $form->toInteractivePayload();
        if ($interactive === null) {
            return ['success' => false, 'error' => "unsupported form type {$form->type}"];
        }

        $phone = $this->normalizePhone($phone);
        // Wablas v2 interactive endpoints authenticate with "token.secret".
        $auth = $this->secret !== '' ? "{$this->token}.{$this->secret}" : $this->token;
        $endpoint = (string) config('services.wablas.interactive_endpoint', '/api/v2/send-interactive');

        $payload = [
            'data' => [[
                'phone'       => $phone,
                'interactive' => $interactive,
            ]],
        ];

        try {
            $response = Http::withHeaders(['Authorization' => $auth])
                ->post("{$this->url}{$endpoint}", $payload);

            $data = $response->json();

            if ($response->successful() && ($data['status'] ?? false) === true) {
                return ['success' => true, 'detail' => $data];
            }

            return [
                'success' => false,
                'error'   => $data['message'] ?? $data['error'] ?? "HTTP {$response->status()}",
            ];
        } catch (\Throwable $e) {
            return ['success' => false, 'error' => $e->getMessage()];
        }
    }

    // ── Device management (Wablas /api/device/*) ─────────────────────────────
    // Endpoints per the official docs: info & scan authenticate with the token
    // alone; disconnect / restart / speed require "token.secret_key".

    /**
     * Live device detail from the gateway: connection status, quota, expiry.
     */
    public function deviceInfo(WaDevice $device): array
    {
        return $this->deviceGet($device, '/api/device/info?token=' . urlencode((string) $device->token));
    }

    /** Disconnect the WhatsApp session from the gateway server. */
    public function disconnectDevice(WaDevice $device): array
    {
        return $this->deviceGet($device, '/api/device/disconnect', authenticated: true);
    }

    /** Restart the device session on the gateway. */
    public function restartDevice(WaDevice $device): array
    {
        return $this->deviceGet($device, '/api/device/restart', authenticated: true);
    }

    /**
     * Set the per-batch send delay (Wablas accepts 10–120 seconds per 5 messages).
     */
    public function setDeviceSpeed(WaDevice $device, int $delay): array
    {
        try {
            $response = Http::withHeaders(['Authorization' => $device->authHeader()])
                ->asForm()
                ->post($device->serverUrl() . '/api/device/speed', ['delay' => (string) $delay]);

            return $this->deviceResult($response->json(), $response->successful(), $response->status());
        } catch (\Throwable $e) {
            return ['success' => false, 'error' => $e->getMessage()];
        }
    }

    /**
     * URL of the gateway page that renders a fresh pairing QR code (used as the
     * "open in new tab" fallback). The path is customizable per device
     * (scan_path, "{token}" placeholder) for non-standard gateways.
     */
    public function qrScanUrl(WaDevice $device): string
    {
        $path = $device->scan_path ?: '/api/device/scan?token={token}';

        return $device->serverUrl() . str_replace('{token}', urlencode((string) $device->token), $path);
    }

    /**
     * Start (or restart) a pairing-QR session on the gateway. Must be called
     * once when the modal opens — but never during polling: a reset aborts any
     * pairing handshake already in flight.
     */
    public function resetQrSession(WaDevice $device, string $serial): bool
    {
        try {
            return Http::timeout(20)
                ->get($device->serverUrl() . "/api/device/reset-qr-code/{$serial}/qr")
                ->successful();
        } catch (\Throwable) {
            return false;
        }
    }

    /**
     * Current pairing-QR frame. WhatsApp rotates the QR every ~20 s, so this is
     * meant to be polled (the gateway's own scan page polls it every second):
     * {message:"success", text:<pairing payload>, image:<png url>, is_ready}.
     */
    public function fetchQrFrame(WaDevice $device, string $serial): ?array
    {
        try {
            $res = Http::timeout(15)->get($device->serverUrl() . "/api/device/qr-code/{$serial}");

            return $res->successful() ? $res->json() : null;
        } catch (\Throwable) {
            return null;
        }
    }

    /** Current pairing-QR PNG (matches the latest frame). */
    public function fetchQrPng(WaDevice $device, string $serial): ?string
    {
        try {
            $img = Http::timeout(15)->get($device->serverUrl() . "/api/device/qr-code-image/{$serial}");

            if ($img->successful() && str_starts_with((string) $img->header('Content-Type'), 'image/')) {
                return $img->body();
            }
        } catch (\Throwable) {
            // fall through
        }

        return null;
    }

    /**
     * Send a plain message through a specific device (used for per-device test
     * sends), regardless of which device is currently active.
     */
    public function sendVia(WaDevice $device, string $phone, string $message): array
    {
        try {
            // Bounded — a hanging gateway must not stall the blast queue worker.
            $response = Http::withHeaders(['Authorization' => (string) $device->token])
                ->timeout(30)
                ->post($device->serverUrl() . '/api/send-message', [
                    'phone' => $this->normalizePhone($phone),
                    'message' => $message,
                ]);

            return $this->deviceResult($response->json(), $response->successful(), $response->status());
        } catch (\Throwable $e) {
            return ['success' => false, 'error' => $e->getMessage()];
        }
    }

    /**
     * Send an image (gateway downloads the URL server-side) with an optional
     * caption. Device-bound, same response shape as sendVia.
     */
    public function sendImageVia(WaDevice $device, string $phone, string $imageUrl, string $caption = ''): array
    {
        try {
            $response = Http::withHeaders(['Authorization' => (string) $device->token])
                ->timeout(45) // image download+send takes longer than text
                ->post($device->serverUrl() . '/api/send-image', [
                    'phone'   => $this->normalizePhone($phone),
                    'image'   => $imageUrl,
                    'caption' => $caption,
                ]);

            return $this->deviceResult($response->json(), $response->successful(), $response->status());
        } catch (\Throwable $e) {
            return ['success' => false, 'error' => $e->getMessage()];
        }
    }

    /** Send a location pin with an optional address label. Device-bound. */
    public function sendLocationVia(WaDevice $device, string $phone, float $lat, float $lng, string $address = ''): array
    {
        try {
            $response = Http::withHeaders(['Authorization' => (string) $device->token])
                ->timeout(30)
                ->post($device->serverUrl() . '/api/send-location', [
                    'phone'     => $this->normalizePhone($phone),
                    'latitude'  => $lat,
                    'longitude' => $lng,
                    'address'   => $address,
                ]);

            return $this->deviceResult($response->json(), $response->successful(), $response->status());
        } catch (\Throwable $e) {
            return ['success' => false, 'error' => $e->getMessage()];
        }
    }

    private function deviceGet(WaDevice $device, string $path, bool $authenticated = false): array
    {
        try {
            $request = $authenticated
                ? Http::withHeaders(['Authorization' => $device->authHeader()])
                : Http::withHeaders([]);

            // Bound the wait so a down gateway can't hang page loads that read
            // device status (WA Blast panel, QR-modal poll).
            $response = $request->timeout(8)->get($device->serverUrl() . $path);

            return $this->deviceResult($response->json(), $response->successful(), $response->status());
        } catch (\Throwable $e) {
            return ['success' => false, 'error' => $e->getMessage()];
        }
    }

    private function deviceResult(?array $data, bool $httpOk, int $httpStatus): array
    {
        if ($httpOk && ($data['status'] ?? false) === true) {
            return ['success' => true, 'detail' => $data];
        }

        return [
            'success' => false,
            'error' => $data['message'] ?? $data['error'] ?? "HTTP {$httpStatus}",
            'detail' => $data,
        ];
    }

    public function normalizePhone(string $phone): string
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
