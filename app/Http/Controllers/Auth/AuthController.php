<?php

declare(strict_types=1);

namespace App\Http\Controllers\Auth;

use App\Http\Controllers\Controller;
use App\Models\LoginAttempt;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\RateLimiter;
use Illuminate\Support\Str;
use Inertia\Inertia;
use Inertia\Response;

class AuthController extends Controller
{
    private const MAX_ATTEMPTS = 5;
    private const LOCKOUT_SECONDS = 900; // 15 minutes

    public function showLogin(): Response
    {
        return Inertia::render('Auth/Login');
    }

    public function login(Request $request): RedirectResponse
    {
        $credentials = $request->validate([
            'email' => ['required', 'email'],
            'password' => ['required'],
        ]);

        $throttleKey = Str::lower($request->input('email')).'|'.$request->ip();

        // Check lockout
        if (RateLimiter::tooManyAttempts($throttleKey, self::MAX_ATTEMPTS)) {
            $seconds = RateLimiter::availableIn($throttleKey);
            $this->logAttempt($request, 'blocked');
            return back()
                ->with('lockout_seconds', $seconds)
                ->withErrors(['email' => "Terlalu banyak percobaan login. Coba lagi dalam {$seconds} detik."])
                ->withInput($request->only('email'));
        }

        if (Auth::attempt($credentials, $request->boolean('remember'))) {
            /** @var \App\Models\User $user */
            $user = Auth::user();

            // Block deactivated accounts immediately after credential check
            if ($user->status !== 'active') {
                Auth::logout();
                $this->logAttempt($request, 'blocked_inactive');
                return back()
                    ->withErrors(['email' => 'Akun Anda tidak aktif. Hubungi administrator.'])
                    ->withInput($request->only('email'));
            }

            RateLimiter::clear($throttleKey);
            $request->session()->regenerate();
            $this->logAttempt($request, 'success');

            $user->update(['last_login_at' => now()]);

            return redirect()->intended('/dashboard');
        }

        RateLimiter::hit($throttleKey, self::LOCKOUT_SECONDS);
        $attempts  = RateLimiter::attempts($throttleKey);
        $remaining = max(0, self::MAX_ATTEMPTS - $attempts);
        $this->logAttempt($request, 'failed');

        $message = $remaining > 0
            ? "Email atau password salah. {$remaining} percobaan tersisa sebelum akun dikunci."
            : 'Email atau password salah. Akun Anda akan dikunci setelah percobaan berikutnya.';

        return back()
            ->withErrors(['email' => $message])
            ->withInput($request->only('email'));
    }

    private function logAttempt(Request $request, string $status): void
    {
        LoginAttempt::create([
            'email'      => $request->input('email'),
            'ip_address' => $request->ip(),
            'user_agent' => $request->userAgent(),
            'status'     => $status,
        ]);
    }

    public function logout(Request $request): RedirectResponse
    {
        Auth::logout();

        $request->session()->invalidate();
        $request->session()->regenerateToken();

        return redirect('/login');
    }
}
