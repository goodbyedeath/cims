<?php

declare(strict_types=1);

namespace App\Http\Controllers\Auth;

use App\Http\Controllers\Controller;
use App\Models\User;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Facades\RateLimiter;
use Illuminate\Support\Str;
use Inertia\Inertia;
use Inertia\Response;

class PasswordResetController extends Controller
{
    public function showForgot(): Response
    {
        return Inertia::render('Auth/ForgotPassword');
    }

    public function sendResetLink(Request $request): RedirectResponse
    {
        // Throttle per email+IP to prevent both brute-force and email harvesting
        $throttleKey = 'forgot:'.Str::lower($request->input('email', '')).'|'.$request->ip();
        if (RateLimiter::tooManyAttempts($throttleKey, 3)) {
            $seconds = RateLimiter::availableIn($throttleKey);
            return back()
                ->with('lockout_seconds', $seconds)
                ->withErrors(['email' => "Terlalu banyak permintaan reset. Coba lagi dalam {$seconds} detik."]);
        }
        $request->validate(['email' => ['required', 'email']]);

        RateLimiter::hit($throttleKey, 600); // 10-minute window

        $user = User::where('email', $request->email)->first();

        if ($user) {
            $token = Str::random(64);

            DB::table('password_reset_tokens')->updateOrInsert(
                ['email' => $request->email],
                ['token' => Hash::make($token), 'created_at' => now()],
            );

            $resetUrl = url("/reset-password?token={$token}&email={$request->email}");

            Mail::raw(
                "Klik link berikut untuk reset password CIMS Anda:\n\n{$resetUrl}\n\nLink berlaku 60 menit.",
                function ($msg) use ($request) {
                    $msg->to($request->email)
                        ->subject('CIMS - Reset Password');
                }
            );
        }

        return back()->with('success', 'Link reset password telah dikirim ke email Anda.');
    }

    public function showReset(Request $request): Response
    {
        return Inertia::render('Auth/ResetPassword', [
            'token' => $request->query('token', ''),
            'email' => $request->query('email', ''),
        ]);
    }

    public function reset(Request $request): RedirectResponse
    {
        $request->validate([
            'token'    => ['required', 'string'],
            'email'    => ['required', 'email', 'exists:users,email'],
            'password' => ['required', 'string', 'min:8', 'confirmed'],
        ]);

        $record = DB::table('password_reset_tokens')
            ->where('email', $request->email)
            ->first();

        if (!$record || !Hash::check($request->token, $record->token)) {
            return back()->withErrors(['token' => 'Token tidak valid atau sudah kedaluwarsa.']);
        }

        // Check if token is expired (60 minutes) — abs=true avoids Carbon 3 signed result
        if (now()->diffInMinutes($record->created_at, true) > 60) {
            return back()->withErrors(['token' => 'Token sudah kedaluwarsa. Silakan request ulang.']);
        }

        $user = User::where('email', $request->email)->first();
        $user->update(['password' => Hash::make($request->password)]);

        DB::table('password_reset_tokens')->where('email', $request->email)->delete();

        return redirect('/login')->with('success', 'Password berhasil direset. Silakan login.');
    }
}
