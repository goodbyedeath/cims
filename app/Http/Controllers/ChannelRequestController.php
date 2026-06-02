<?php

declare(strict_types=1);

namespace App\Http\Controllers;

use App\Models\Channel;
use App\Models\ChannelRequest;
use App\Models\ChannelRequestLog;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Inertia\Inertia;
use Inertia\Response;

class ChannelRequestController extends Controller
{
    public function index(Request $request): Response
    {
        $filters = $request->only(['search', 'status', 'sort_by', 'sort_dir']);

        $sortable = ['created_at', 'status'];
        $sortBy   = in_array($filters['sort_by'] ?? '', $sortable, true) ? $filters['sort_by'] : 'created_at';
        $sortDir  = ($filters['sort_dir'] ?? 'desc') === 'asc' ? 'asc' : 'desc';

        $requests = ChannelRequest::with(['channel:id,channel_code,company_name', 'user:id,name'])
            ->when($filters['search'] ?? null, function ($q, $search) {
                $q->where(function ($qq) use ($search) {
                    $qq->where('request', 'like', "%{$search}%")
                        ->orWhereHas('channel', fn ($c) => $c->where('company_name', 'like', "%{$search}%"));
                });
            })
            ->when($filters['status'] ?? null, fn ($q, $status) => $q->where('status', $status))
            ->orderBy($sortBy, $sortDir)
            ->paginate(15)
            ->withQueryString();

        $channels = Channel::orderBy('company_name')
            ->get(['id', 'channel_code', 'company_name']);

        return Inertia::render('ChannelRequests/Index', [
            'requests' => $requests,
            'channels' => $channels,
            'filters' => $filters,
        ]);
    }

    public function store(Request $request): RedirectResponse
    {
        $validated = $request->validate([
            'channel_id' => ['required', 'exists:channels,id'],
            'request' => ['required', 'string'],
        ]);

        $channelRequest = ChannelRequest::create([
            ...$validated,
            'user_id' => Auth::id(),
            'status' => 'pending',
        ]);

        ChannelRequestLog::create([
            'channel_request_id' => $channelRequest->id,
            'user_id' => Auth::id(),
            'from_status' => null,
            'to_status' => 'pending',
        ]);

        return back()->with('success', 'Request created successfully.');
    }

    public function show(ChannelRequest $channelRequest): Response
    {
        $channelRequest->load([
            'channel:id,channel_code,company_name',
            'user:id,name',
            'logs' => fn ($q) => $q->with('user:id,name')->latest(),
        ]);

        return Inertia::render('ChannelRequests/Show', [
            'channelRequest' => $channelRequest,
        ]);
    }

    public function updateStatus(Request $request, ChannelRequest $channelRequest): RedirectResponse
    {
        $validated = $request->validate([
            'status' => ['required', 'in:pending,done,cancelled'],
            'note' => ['nullable', 'string'],
        ]);

        $fromStatus = $channelRequest->status;
        $channelRequest->update(['status' => $validated['status']]);

        ChannelRequestLog::create([
            'channel_request_id' => $channelRequest->id,
            'user_id' => Auth::id(),
            'from_status' => $fromStatus,
            'to_status' => $validated['status'],
            'note' => $validated['note'] ?? null,
        ]);

        return back()->with('success', 'Status updated to ' . $validated['status'] . '.');
    }

    public function destroy(ChannelRequest $channelRequest): RedirectResponse
    {
        $channelRequest->delete();

        return redirect()->route('channel-requests.index')
            ->with('success', 'Request deleted.');
    }
}
