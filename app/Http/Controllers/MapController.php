<?php

declare(strict_types=1);

namespace App\Http\Controllers;

use App\Models\Channel;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

class MapController extends Controller
{
    public function index(Request $request): Response
    {
        $filters = $request->only(['status', 'grade', 'province']);

        $channels = Channel::query()
            ->whereNotNull('latitude')
            ->whereNotNull('longitude')
            ->when($filters['status'] ?? null, fn ($q, $status) => $q->where('status', $status))
            ->when($filters['grade'] ?? null, fn ($q, $grade) => $q->where('channel_grade', $grade))
            ->when($filters['province'] ?? null, fn ($q, $province) => $q->where('province', $province))
            ->with('aiScore')
            ->get([
                'id', 'channel_code', 'company_name', 'owner_name', 'phone',
                'address', 'province', 'city', 'latitude', 'longitude',
                'status', 'channel_grade', 'performance_score',
            ]);

        // Only return provinces that have at least one channel with coordinates
        $provinces = Channel::whereNotNull('latitude')
            ->whereNotNull('longitude')
            ->distinct()
            ->pluck('province')
            ->filter()
            ->sort()
            ->values();

        return Inertia::render('Map/Index', [
            'channels' => $channels,
            'filters' => $filters,
            'provinces' => $provinces,
        ]);
    }
}
