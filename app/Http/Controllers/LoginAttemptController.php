<?php

declare(strict_types=1);

namespace App\Http\Controllers;

use App\Models\LoginAttempt;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

class LoginAttemptController extends Controller
{
    public function index(Request $request): Response
    {
        $sortable = ['attempted_at', 'email', 'ip_address', 'status'];
        $sortByIn = $request->input('sort_by', '');
        $sortBy   = in_array($sortByIn, $sortable, true) ? $sortByIn : 'attempted_at';
        $sortDir  = $request->input('sort_dir', 'desc') === 'asc' ? 'asc' : 'desc';

        $query = LoginAttempt::query()->orderBy($sortBy, $sortDir);

        if ($status = $request->input('status')) {
            $query->where('status', $status);
        }

        if ($email = $request->input('email')) {
            $query->where('email', 'like', "%{$email}%");
        }

        if ($ip = $request->input('ip')) {
            $query->where('ip_address', 'like', "%{$ip}%");
        }

        if ($date = $request->input('date')) {
            $query->whereDate('attempted_at', $date);
        }

        $attempts = $query->paginate(50)->withQueryString();

        // Stats
        $today = now()->toDateString();
        $stats = [
            'total_today'   => LoginAttempt::whereDate('attempted_at', $today)->count(),
            'failed_today'  => LoginAttempt::whereDate('attempted_at', $today)->where('status', 'failed')->count(),
            'blocked_today' => LoginAttempt::whereDate('attempted_at', $today)->where('status', 'blocked')->count(),
            'success_today' => LoginAttempt::whereDate('attempted_at', $today)->where('status', 'success')->count(),
            'unique_ips_today' => LoginAttempt::whereDate('attempted_at', $today)
                ->where('status', '!=', 'success')
                ->distinct('ip_address')
                ->count('ip_address'),
        ];

        return Inertia::render('LoginAttempts/Index', [
            'attempts' => $attempts,
            'stats'    => $stats,
            'filters'  => $request->only(['status', 'email', 'ip', 'date', 'sort_by', 'sort_dir']),
        ]);
    }
}
