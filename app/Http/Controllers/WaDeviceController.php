<?php

declare(strict_types=1);

namespace App\Http\Controllers;

use App\Models\CatalogSetting;
use App\Models\WaDevice;
use App\Services\MetaCloudService;
use App\Services\WhatsAppService;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

class WaDeviceController extends Controller
{
    /**
     * Device manager for the Wablas WhatsApp gateway. Tokens are stored
     * encrypted and never sent to the page — only a short hint is exposed.
     * The single "active" device is the one WhatsAppService sends through.
     */
    public function index(WhatsAppService $wa, MetaCloudService $meta): Response
    {
        $devices = WaDevice::orderByDesc('is_active')->orderBy('name')->get()
            ->map(fn (WaDevice $d) => [
                'id' => $d->id,
                'name' => $d->name,
                'purpose' => $d->purpose,
                'server_url' => $d->serverUrl(),
                'token_hint' => $d->tokenHint(),
                'has_secret' => (string) ($d->secret_key ?? '') !== '',
                'scan_path' => $d->scan_path,
                'phone' => $d->phone,
                'is_active' => $d->is_active,
                'last_status' => $d->last_status,
                'last_info' => $d->last_info,
                'last_checked_at' => $d->last_checked_at?->toIso8601String(),
            ]);

        return Inertia::render('WaDevices/Index', [
            'devices' => $devices,
            // When no device row is active, sending falls back to the .env token.
            'env_fallback' => ! $devices->contains('is_active', true)
                && ! empty(config('services.wablas.token')),
            // WA provider switch (baileys ⇄ meta) + readiness of each side.
            'driver' => $wa->driver(),
            'meta'   => [
                'send_ready'    => $meta->isConfigured(),
                'webhook_ready' => ! empty(config('services.whatsapp_cloud.verify_token'))
                    && ! empty(config('services.whatsapp_cloud.app_secret')),
            ],
            'blastSettings' => $this->blastSettings(),
        ]);
    }

    /** Blast anti-ban knobs (persisted in CatalogSetting), with defaults. */
    private function blastSettings(): array
    {
        $defaults = [
            'blast_cooldown_days' => 14,
            'blast_drip_hour_start' => 8,
            'blast_drip_hour_end' => 17,
            'blast_drip_warmup_days' => 3,
            'blast_drip_daily_min' => 12,
            'blast_drip_daily_max' => 35,
            'blast_drip_rest_pct' => 25,
            'blast_disconnect_giveup_hours' => 12,
        ];

        $out = [];
        foreach ($defaults as $key => $default) {
            $out[$key] = (int) CatalogSetting::getValue($key, $default);
        }

        return $out;
    }

    /** Save the blast anti-ban settings from the WA Devices page. */
    public function saveBlastSettings(Request $request): RedirectResponse
    {
        $data = $request->validate([
            'blast_cooldown_days' => ['required', 'integer', 'min:0', 'max:365'],
            'blast_drip_hour_start' => ['required', 'integer', 'min:0', 'max:23'],
            'blast_drip_hour_end' => ['required', 'integer', 'min:1', 'max:24', 'gt:blast_drip_hour_start'],
            'blast_drip_warmup_days' => ['required', 'integer', 'min:1', 'max:30'],
            'blast_drip_daily_min' => ['required', 'integer', 'min:1', 'max:1000'],
            'blast_drip_daily_max' => ['required', 'integer', 'min:1', 'max:2000', 'gte:blast_drip_daily_min'],
            'blast_drip_rest_pct' => ['required', 'integer', 'min:0', 'max:100'],
            'blast_disconnect_giveup_hours' => ['required', 'integer', 'min:1', 'max:168'],
        ]);

        foreach ($data as $key => $value) {
            CatalogSetting::setValue($key, (string) $value);
        }

        return back()->with('success', 'Pengaturan blast disimpan.');
    }

    /** Switch the active WA provider (persisted in settings). */
    public function setDriver(Request $request): RedirectResponse
    {
        $data = $request->validate(['driver' => ['required', 'in:baileys,meta']]);

        CatalogSetting::setValue('wa_driver', $data['driver']);

        $label = $data['driver'] === 'meta' ? 'Meta Cloud API' : 'Baileys Gateway';

        return back()->with('success', "Provider WhatsApp aktif: {$label}.");
    }

    public function store(Request $request): RedirectResponse
    {
        $data = $this->validateDevice($request, tokenRequired: true);

        $device = new WaDevice($data);
        $this->persistActivation($device, (bool) ($data['is_active'] ?? false));

        return back()->with('success', "Device \"{$device->name}\" ditambahkan.");
    }

    public function update(Request $request, WaDevice $waDevice): RedirectResponse
    {
        $data = $this->validateDevice($request, tokenRequired: false);

        // Blank token/secret in the edit form means "keep the current value".
        if (($data['token'] ?? '') === '') {
            unset($data['token']);
        }
        if (($data['secret_key'] ?? '') === '') {
            unset($data['secret_key']);
        }

        $waDevice->fill($data);
        $this->persistActivation($waDevice, (bool) ($data['is_active'] ?? false));

        return back()->with('success', "Device \"{$waDevice->name}\" diperbarui.");
    }

    public function destroy(WaDevice $waDevice): RedirectResponse
    {
        $waDevice->delete();

        return back()->with('success', "Device \"{$waDevice->name}\" dihapus.");
    }

    /** Make this the (only) device used for all outbound sending. */
    public function activate(WaDevice $waDevice): RedirectResponse
    {
        $this->persistActivation($waDevice, true);

        return back()->with('success', "Device \"{$waDevice->name}\" sekarang aktif untuk pengiriman.");
    }

    /** Pull live status/quota/expiry from the gateway and cache it. */
    public function refresh(WaDevice $waDevice, WhatsAppService $wa): RedirectResponse
    {
        $result = $wa->deviceInfo($waDevice);

        $info = $result['detail'] ?? null;
        $waDevice->update([
            'last_status' => $result['success']
                ? strtolower((string) (data_get($info, 'data.status') ?: 'connected'))
                : 'error',
            'last_info' => $info,
            'last_checked_at' => now(),
        ]);

        return $result['success']
            ? back()->with('success', 'Status device diperbarui dari gateway.')
            : back()->with('error', 'Gagal mengambil info device: ' . $result['error']);
    }

    public function disconnect(WaDevice $waDevice, WhatsAppService $wa): RedirectResponse
    {
        $result = $wa->disconnectDevice($waDevice);

        if ($result['success']) {
            $waDevice->update(['last_status' => 'disconnected', 'last_checked_at' => now()]);

            return back()->with('success', 'Device diputus dari server gateway.');
        }

        return back()->with('error', 'Gagal disconnect: ' . $result['error']);
    }

    public function restart(WaDevice $waDevice, WhatsAppService $wa): RedirectResponse
    {
        $result = $wa->restartDevice($waDevice);

        return $result['success']
            ? back()->with('success', 'Device di-restart di server gateway.')
            : back()->with('error', 'Gagal restart: ' . $result['error']);
    }

    /** Change the per-batch send delay (anti-ban throttle), 10–120 seconds. */
    public function speed(Request $request, WaDevice $waDevice, WhatsAppService $wa): RedirectResponse
    {
        $data = $request->validate(['delay' => ['required', 'integer', 'min:10', 'max:120']]);

        $result = $wa->setDeviceSpeed($waDevice, (int) $data['delay']);

        return $result['success']
            ? back()->with('success', "Delay pengiriman diubah ke {$data['delay']} detik / 5 pesan.")
            : back()->with('error', 'Gagal mengubah speed: ' . $result['error']);
    }

    /** Send a test message through this specific device. */
    public function test(Request $request, WaDevice $waDevice, WhatsAppService $wa): RedirectResponse
    {
        $data = $request->validate(['phone' => ['required', 'string', 'max:30']]);

        // A 200 from the gateway only means it replied — confirm the number is
        // actually paired first, so a disconnected device gives a clear message
        // instead of a cryptic send error.
        $info = $wa->deviceInfo($waDevice);
        $status = strtolower((string) data_get($info, 'detail.data.status'));
        if (! ($info['success'] ?? false) || $status !== 'connected') {
            $suffix = $status ? " ({$status})" : '';

            return back()->with('error', "Device \"{$waDevice->name}\" TIDAK terhubung{$suffix} — scan QR dulu.");
        }

        $result = $wa->sendVia(
            $waDevice,
            $data['phone'],
            "✅ Test pesan dari CIMS — device \"{$waDevice->name}\" berfungsi.",
        );

        return $result['success']
            ? back()->with('success', "Pesan test terkirim ke {$data['phone']}.")
            : back()->with('error', 'Test gagal: ' . $result['error']);
    }

    /**
     * Open the gateway's pairing-QR page (fallback for the modal). Redirect
     * (not a rendered link) so the token never appears in our HTML.
     */
    public function qr(WaDevice $waDevice, WhatsAppService $wa): \Illuminate\Http\RedirectResponse
    {
        return redirect()->away($wa->qrScanUrl($waDevice));
    }

    /**
     * Begin a pairing-QR session (gateway reset). Called once when the QR modal
     * opens or on a manual reload — never while polling, because a reset kills
     * any pairing handshake in progress.
     */
    public function qrStart(WaDevice $waDevice, WhatsAppService $wa): \Illuminate\Http\JsonResponse
    {
        $serial = $this->deviceSerial($waDevice, $wa);

        if ($serial === null) {
            return response()->json(['ok' => false, 'message' => 'Serial device tidak ditemukan — jalankan "Cek Status" dan pastikan token valid.'], 502);
        }

        return response()->json(['ok' => $wa->resetQrSession($waDevice, $serial)]);
    }

    /**
     * Current QR frame for the modal, polled every ~2.5 s. WhatsApp rotates the
     * pairing QR every ~20 s — a static image goes stale before the user scans
     * it (scan "succeeds" on the phone, link silently fails). The modal sends
     * the last frame's stamp; the PNG is only re-fetched when the frame rotated.
     */
    public function qrFrame(Request $request, WaDevice $waDevice, WhatsAppService $wa): \Illuminate\Http\JsonResponse
    {
        $serial = $this->deviceSerial($waDevice, $wa);
        if ($serial === null) {
            return response()->json(['ok' => false, 'expired' => false]);
        }

        $frame = $wa->fetchQrFrame($waDevice, $serial);
        $text = (string) data_get($frame, 'text', '');

        if (! $frame || data_get($frame, 'message') !== 'success' || $text === '') {
            // Session expired / not started — the modal will call qr/start again.
            return response()->json(['ok' => false, 'expired' => true]);
        }

        $stamp = md5($text);
        if ($request->query('since') === $stamp) {
            return response()->json(['ok' => true, 'changed' => false, 'stamp' => $stamp]);
        }

        $png = $wa->fetchQrPng($waDevice, $serial);
        if ($png === null) {
            return response()->json(['ok' => true, 'changed' => false, 'stamp' => $stamp]);
        }

        return response()->json([
            'ok' => true,
            'changed' => true,
            'stamp' => $stamp,
            'image' => 'data:image/png;base64,' . base64_encode($png),
        ]);
    }

    /**
     * Lightweight status poll for the QR modal: tells it when the device has
     * finished pairing (status flips to "connected"). Also refreshes the cache.
     */
    public function qrStatus(WaDevice $waDevice, WhatsAppService $wa): \Illuminate\Http\JsonResponse
    {
        $result = $wa->deviceInfo($waDevice);
        $status = $result['success']
            ? strtolower((string) (data_get($result['detail'], 'data.status') ?: 'unknown'))
            : 'error';

        if ($result['success']) {
            $waDevice->update([
                'last_status' => $status,
                'last_info' => $result['detail'],
                'last_checked_at' => now(),
            ]);
        }

        return response()->json(['status' => $status, 'connected' => $status === 'connected']);
    }

    /**
     * The gateway's QR endpoints key on the device *serial*, which we learn
     * from /api/device/info — use the cached copy, fetch live if missing.
     */
    private function deviceSerial(WaDevice $waDevice, WhatsAppService $wa): ?string
    {
        $serial = data_get($waDevice->last_info, 'data.serial');

        if (! $serial) {
            $result = $wa->deviceInfo($waDevice);
            if ($result['success']) {
                $waDevice->update([
                    'last_info' => $result['detail'],
                    'last_checked_at' => now(),
                ]);
                $serial = data_get($result['detail'], 'data.serial');
            }
        }

        return $serial ? (string) $serial : null;
    }

    private function validateDevice(Request $request, bool $tokenRequired): array
    {
        $data = $request->validate([
            'name' => ['required', 'string', 'max:100'],
            'purpose' => ['required', 'in:' . implode(',', WaDevice::PURPOSES)],
            'server_url' => ['required', 'url', 'max:120'],
            'token' => [$tokenRequired ? 'required' : 'nullable', 'string', 'max:255'],
            'secret_key' => ['nullable', 'string', 'max:255'],
            'scan_path' => ['nullable', 'string', 'max:200', 'starts_with:/'],
            'phone' => ['nullable', 'string', 'max:30'],
            'is_active' => ['boolean'],
        ]);

        // Blank scan path = use the standard Wablas connector endpoint.
        $data['scan_path'] = ($data['scan_path'] ?? '') !== '' ? $data['scan_path'] : null;

        return $data;
    }

    /**
     * Save the device, keeping "is_active" exclusive *per purpose*: activating
     * a device deactivates the other devices with the same purpose, so one
     * OTP device and one blast device (and one general) can be active at once.
     */
    private function persistActivation(WaDevice $device, bool $active): void
    {
        $device->is_active = $active;
        $device->save();

        if ($active) {
            WaDevice::whereKeyNot($device->id)
                ->where('purpose', $device->purpose)
                ->where('is_active', true)
                ->update(['is_active' => false]);
        }
    }
}
