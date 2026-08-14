<?php

declare(strict_types=1);

namespace App\Http\Controllers;

use App\Models\EmailAccount;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Mail;

/**
 * SMTP account management for the email-blast system. JSON endpoints consumed
 * by the "Kelola Akun" modal on the Email Blast page. Every user may manage
 * their own personal accounts; only admins may create/edit shared accounts
 * (user_id NULL) or touch other users' accounts.
 */
class EmailAccountController extends Controller
{
    public function index(): JsonResponse
    {
        $user = Auth::user();

        $accounts = ($user->role === 'admin'
                ? EmailAccount::query()
                : EmailAccount::visibleTo($user))
            ->with('user:id,name')
            ->orderBy('name')
            ->get()
            ->map(fn (EmailAccount $a) => [
                'id' => $a->id,
                'name' => $a->name,
                'email' => $a->email,
                'from_name' => $a->from_name,
                'smtp_host' => $a->smtp_host,
                'smtp_port' => $a->smtp_port,
                'encryption' => $a->encryption,
                'user_id' => $a->user_id,
                'owner' => $a->user?->name,
                'editable' => $user->role === 'admin' || $a->user_id === $user->id,
            ]);

        return response()->json($accounts);
    }

    public function store(Request $request): JsonResponse
    {
        $data = $this->validateAccount($request, passwordRequired: true);

        $account = EmailAccount::create($data + ['user_id' => $this->resolveOwner($request)]);

        return response()->json(['ok' => true, 'id' => $account->id, 'message' => "Akun \"{$account->name}\" ditambahkan."]);
    }

    public function update(Request $request, EmailAccount $emailAccount): JsonResponse
    {
        $this->authorizeAccount($emailAccount);

        $data = $this->validateAccount($request, passwordRequired: false);

        // Blank password = keep the current one.
        if (($data['password'] ?? '') === '') {
            unset($data['password']);
        }

        if (Auth::user()->role === 'admin') {
            $data['user_id'] = $this->resolveOwner($request);
        }

        $emailAccount->update($data);

        return response()->json(['ok' => true, 'message' => "Akun \"{$emailAccount->name}\" diperbarui."]);
    }

    public function destroy(EmailAccount $emailAccount): JsonResponse
    {
        $this->authorizeAccount($emailAccount);

        $emailAccount->delete();

        return response()->json(['ok' => true, 'message' => "Akun \"{$emailAccount->name}\" dihapus."]);
    }

    /**
     * Real SMTP round-trip: send a test message through this account to prove
     * host/credentials work before it's used for a blast.
     */
    public function test(Request $request, EmailAccount $emailAccount): JsonResponse
    {
        $data = $request->validate(['email' => ['nullable', 'email']]);
        $to = $data['email'] ?? Auth::user()->email;

        try {
            Mail::build($emailAccount->mailerConfig())->html(
                '<p>Tes koneksi SMTP berhasil — akun <strong>' . e($emailAccount->name) . '</strong> (' . e($emailAccount->email) . ') siap dipakai untuk email blast.</p>',
                fn ($msg) => $msg
                    ->from($emailAccount->email, $emailAccount->from_name ?: $emailAccount->name)
                    ->to($to)
                    ->subject('[TEST] Koneksi akun email CIMS'),
            );
        } catch (\Throwable $e) {
            return response()->json(['ok' => false, 'message' => 'Koneksi gagal: ' . $e->getMessage()], 422);
        }

        return response()->json(['ok' => true, 'message' => "Koneksi OK — email test terkirim ke {$to}."]);
    }

    private function validateAccount(Request $request, bool $passwordRequired): array
    {
        return $request->validate([
            'name' => ['required', 'string', 'max:100'],
            'email' => ['required', 'email', 'max:255'],
            'from_name' => ['nullable', 'string', 'max:100'],
            'smtp_host' => ['required', 'string', 'max:255'],
            'smtp_port' => ['required', 'integer', 'min:1', 'max:65535'],
            'encryption' => ['required', 'in:ssl,tls'],
            'password' => [$passwordRequired ? 'required' : 'nullable', 'string', 'max:255'],
        ]);
    }

    /** Admins may create shared accounts; everyone else owns what they create. */
    private function resolveOwner(Request $request): ?int
    {
        if (Auth::user()->role === 'admin' && $request->boolean('shared')) {
            return null;
        }

        return Auth::id();
    }

    private function authorizeAccount(EmailAccount $account): void
    {
        abort_unless(
            Auth::user()->role === 'admin' || $account->user_id === Auth::id(),
            403,
            'Anda tidak berhak mengubah akun ini.',
        );
    }
}
