<?php

declare(strict_types=1);

namespace App\Http\Controllers;

use App\Models\Channel;
use App\Services\AiScoringService;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

class AiScoreController extends Controller
{
    public function index(Request $request): Response
    {
        $filters = $request->only(['search', 'grade']);

        $channels = Channel::with('aiScore')
            ->when($filters['search'] ?? null, function ($q, $search) {
                $q->where(function ($query) use ($search) {
                    $query->where('company_name', 'like', "%{$search}%")
                        ->orWhere('channel_code', 'like', "%{$search}%");
                });
            })
            ->when($filters['grade'] ?? null, fn ($q, $grade) => $q->where('channel_grade', $grade))
            ->orderByDesc('performance_score')
            ->paginate(15)
            ->withQueryString();

        return Inertia::render('Dashboard/AiScores', [
            'channels' => $channels,
            'filters' => $filters,
        ]);
    }

    public function recalculate(AiScoringService $service): RedirectResponse
    {
        $service->scoreAllChannels();

        return back()->with('success', 'AI scores recalculated successfully.');
    }
}
