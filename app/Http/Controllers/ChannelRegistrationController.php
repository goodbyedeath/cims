<?php

declare(strict_types=1);

namespace App\Http\Controllers;

use App\Models\Channel;
use App\Models\User;
use App\Notifications\NewChannelNotification;
use App\Services\WhatsAppService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;

/**
 * Public channel self-registration from /catalog/public.
 *
 * Flow: visitor fills a simplified form (owner, company, WhatsApp phone,
 * email, full address) → we send a 6-digit OTP to the phone via the connected
 * Wablas device → correct OTP proves the number is WhatsApp-registered AND
 * owned by the registrant → a Channel is created with status "inactive"
 * (pending review by the sales team) and staff are notified in-app.
 */
class ChannelRegistrationController extends Controller
{
    private const OTP_TTL_MINUTES = 10;
    private const OTP_RESEND_COOLDOWN = 60; // seconds

    /** Step 1 — send the WhatsApp verification code. */
    public function sendOtp(Request $request, WhatsAppService $wa): JsonResponse
    {
        $data = $request->validate([
            'phone' => ['required', 'string', 'min:9', 'max:20'],
        ]);

        $phone = $wa->normalizePhone($data['phone']);

        if (! preg_match('/^62\d{8,13}$/', $phone)) {
            return response()->json(['ok' => false, 'message' => 'Format nomor tidak valid. Gunakan 08xx atau 628xx.'], 422);
        }

        if ($this->phoneExists($phone)) {
            return response()->json(['ok' => false, 'message' => 'Nomor ini sudah terdaftar sebagai channel. Hubungi sales kami jika ada kendala.'], 422);
        }

        // Per-phone resend cooldown (on top of the per-IP route throttle).
        if (! Cache::add("catalog_reg_cooldown:{$phone}", 1, self::OTP_RESEND_COOLDOWN)) {
            return response()->json(['ok' => false, 'message' => 'Kode baru saja dikirim. Tunggu 1 menit untuk kirim ulang.'], 429);
        }

        $code = (string) random_int(100000, 999999);
        Cache::put("catalog_reg_otp:{$phone}", $code, now()->addMinutes(self::OTP_TTL_MINUTES));

        $res = $wa->send($phone, "Kode verifikasi pendaftaran channel Anda: *{$code}*\n\nBerlaku " . self::OTP_TTL_MINUTES . " menit. Jangan bagikan kode ini kepada siapa pun.", 'otp');

        if (! $res['success']) {
            Cache::forget("catalog_reg_cooldown:{$phone}");

            return response()->json(['ok' => false, 'message' => 'Gagal mengirim kode WhatsApp. Pastikan nomor terdaftar di WhatsApp, lalu coba lagi.'], 422);
        }

        return response()->json(['ok' => true, 'message' => 'Kode verifikasi dikirim via WhatsApp.']);
    }

    /** Step 2 — verify the OTP and create the pending channel. */
    public function register(Request $request, WhatsAppService $wa): JsonResponse
    {
        $data = $request->validate([
            'owner_name'   => ['required', 'string', 'max:255'],
            'company_name' => ['required', 'string', 'max:255'],
            'phone'        => ['required', 'string', 'min:9', 'max:20'],
            'email'        => ['required', 'email', 'max:255'],
            // Parsed by the same "Alamat, Kecamatan, Kota, Provinsi" auto-fill
            // format used by the internal channel form.
            'address'      => ['required', 'string', 'max:500'],
            'district'     => ['nullable', 'string', 'max:255'],
            'city'         => ['required', 'string', 'max:255'],
            'province'     => ['required', 'string', 'max:255'],
            'latitude'     => ['nullable', 'numeric', 'between:-90,90'],
            'longitude'    => ['nullable', 'numeric', 'between:-180,180'],
            'otp'          => ['required', 'digits:6'],
        ], [
            'city.required' => 'Alamat belum lengkap — gunakan format: Alamat, Kecamatan, Kota, Provinsi.',
            'province.required' => 'Alamat belum lengkap — gunakan format: Alamat, Kecamatan, Kota, Provinsi.',
        ]);

        $phone = $wa->normalizePhone($data['phone']);

        $cached = Cache::get("catalog_reg_otp:{$phone}");
        if ($cached === null || ! hash_equals($cached, $data['otp'])) {
            return response()->json(['ok' => false, 'message' => 'Kode verifikasi salah atau kedaluwarsa. Kirim ulang kode.'], 422);
        }

        if ($this->phoneExists($phone)) {
            return response()->json(['ok' => false, 'message' => 'Nomor ini sudah terdaftar sebagai channel.'], 422);
        }
        if (Channel::where('email', $data['email'])->exists()) {
            return response()->json(['ok' => false, 'message' => 'Email ini sudah terdaftar sebagai channel.'], 422);
        }

        $channel = Channel::create([
            'channel_code' => $this->generateUniqueCode(),
            'company_name' => $data['company_name'],
            'owner_name'   => $data['owner_name'],
            'phone'        => $phone,
            'email'        => $data['email'],
            'address'      => $data['address'],
            'district'     => $data['district'] ?? '',
            'city'         => $data['city'],
            'province'     => $data['province'],
            'latitude'     => $data['latitude'] ?? null,
            'longitude'    => $data['longitude'] ?? null,
            // Pending review — the team activates it after verification.
            'status'       => 'inactive',
        ]);

        Cache::forget("catalog_reg_otp:{$phone}");

        // Unlock the registered-channel special price for this session.
        $request->session()->put('catalog_registered_auth', true);

        // Notify staff in-app (same notification as manual channel creation).
        foreach (User::all() as $user) {
            $user->notify(new NewChannelNotification($channel));
        }

        // Confirmation to the registrant — best effort, ignore failure.
        $wa->send($phone, "Terima kasih! Pendaftaran channel *{$data['company_name']}* telah kami terima (kode: {$channel->channel_code}).\n\nTim kami akan menghubungi Anda untuk verifikasi. 🙏", 'otp');

        return response()->json([
            'ok' => true,
            'message' => 'Pendaftaran diterima! Tim kami akan menghubungi Anda via WhatsApp untuk verifikasi.',
        ]);
    }

    /**
     * Returning registered channel — step 1: send the login OTP. Mirror of
     * sendOtp() with the existence check inverted (the phone MUST already be a
     * channel), so returning users can re-unlock the special price on later
     * visits without re-registering.
     */
    public function loginOtp(Request $request, WhatsAppService $wa): JsonResponse
    {
        $data = $request->validate([
            'phone' => ['required', 'string', 'min:9', 'max:20'],
        ]);

        $phone = $wa->normalizePhone($data['phone']);

        if (! preg_match('/^62\d{8,13}$/', $phone)) {
            return response()->json(['ok' => false, 'message' => 'Format nomor tidak valid. Gunakan 08xx atau 628xx.'], 422);
        }

        if (! $this->phoneExists($phone)) {
            return response()->json(['ok' => false, 'message' => 'Nomor ini belum terdaftar sebagai channel. Silakan daftar terlebih dahulu.'], 422);
        }

        if (! Cache::add("catalog_reg_cooldown:{$phone}", 1, self::OTP_RESEND_COOLDOWN)) {
            return response()->json(['ok' => false, 'message' => 'Kode baru saja dikirim. Tunggu 1 menit untuk kirim ulang.'], 429);
        }

        $code = (string) random_int(100000, 999999);
        Cache::put("catalog_reg_otp:{$phone}", $code, now()->addMinutes(self::OTP_TTL_MINUTES));

        $res = $wa->send($phone, "Kode verifikasi akses harga spesial Anda: *{$code}*\n\nBerlaku " . self::OTP_TTL_MINUTES . " menit. Jangan bagikan kode ini kepada siapa pun.", 'otp');

        if (! $res['success']) {
            Cache::forget("catalog_reg_cooldown:{$phone}");

            return response()->json(['ok' => false, 'message' => 'Gagal mengirim kode WhatsApp. Coba lagi sebentar lagi.'], 422);
        }

        return response()->json(['ok' => true, 'message' => 'Kode verifikasi dikirim via WhatsApp.']);
    }

    /** Returning registered channel — step 2: verify OTP, unlock special price. */
    public function login(Request $request, WhatsAppService $wa): JsonResponse
    {
        $data = $request->validate([
            'phone' => ['required', 'string', 'min:9', 'max:20'],
            'otp'   => ['required', 'digits:6'],
        ]);

        $phone = $wa->normalizePhone($data['phone']);

        $cached = Cache::get("catalog_reg_otp:{$phone}");
        if ($cached === null || ! hash_equals($cached, $data['otp'])) {
            return response()->json(['ok' => false, 'message' => 'Kode verifikasi salah atau kedaluwarsa. Kirim ulang kode.'], 422);
        }

        if (! $this->phoneExists($phone)) {
            return response()->json(['ok' => false, 'message' => 'Nomor ini belum terdaftar sebagai channel.'], 422);
        }

        Cache::forget("catalog_reg_otp:{$phone}");
        $request->session()->put('catalog_registered_auth', true);

        return response()->json(['ok' => true, 'message' => 'Verifikasi berhasil — harga spesial aktif.']);
    }

    /** Match both stored formats (628xx and 08xx). */
    private function phoneExists(string $normalized): bool
    {
        $localVariant = '0' . substr($normalized, 2);

        return Channel::whereIn('phone', [$normalized, $localVariant])->exists();
    }

    /** Same CH-xxxx format as ChannelController::generateUniqueCode(). */
    private function generateUniqueCode(): string
    {
        do {
            $code = 'CH-' . str_pad((string) random_int(1, 9999), 4, '0', STR_PAD_LEFT);
        } while (Channel::withTrashed()->where('channel_code', $code)->exists());

        return $code;
    }
}
