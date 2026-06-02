<?php

declare(strict_types=1);

namespace App\Http\Controllers;

use App\Models\Channel;
use App\Models\WaBlast;
use App\Services\WhatsAppService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Inertia\Inertia;
use Inertia\Response;

class WaBlastController extends Controller
{
    public function index(Request $request): Response
    {
        $blasts = WaBlast::with('user:id,name')
            ->latest()
            ->paginate(15)
            ->withQueryString();

        $provinces = Channel::where('status', 'active')
            ->whereNotNull('phone')
            ->where('phone', '!=', '')
            ->distinct()
            ->pluck('province')
            ->filter()
            ->sort()
            ->values();

        return Inertia::render('WaBlast/Index', [
            'blasts' => $blasts,
            'provinces' => $provinces,
        ]);
    }

    public function preview(Request $request): JsonResponse
    {
        $request->validate([
            'target' => ['required', 'in:all,filtered,selected'],
            'filters' => ['nullable', 'array'],
            'filters.province' => ['nullable', 'string'],
            'filters.grade' => ['nullable', 'string'],
            'filters.status' => ['nullable', 'string'],
            'channel_ids' => ['nullable', 'array'],
            'channel_ids.*' => ['integer', 'exists:channels,id'],
        ]);

        $query = $this->buildChannelQuery($request);
        $channels = $query->get(['id', 'channel_code', 'company_name', 'phone', 'province', 'channel_grade']);

        return response()->json([
            'count' => $channels->count(),
            'channels' => $channels,
        ]);
    }

    public function send(Request $request, WhatsAppService $wa): RedirectResponse
    {
        $request->validate([
            'title' => ['required', 'string', 'max:100'],
            'message' => ['required', 'string', 'max:5000'],
            'target' => ['required', 'in:all,filtered,selected'],
            'filters' => ['nullable', 'array'],
            'channel_ids' => ['nullable', 'array'],
        ]);

        $query = $this->buildChannelQuery($request);
        $channels = $query->get(['id', 'channel_code', 'company_name', 'phone', 'owner_name']);

        if ($channels->isEmpty()) {
            return back()->with('error', 'No channels with phone numbers found.');
        }

        // Create blast record
        $blast = WaBlast::create([
            'user_id' => Auth::id(),
            'title' => $request->title,
            'message' => $request->message,
            'total_recipients' => $channels->count(),
            'status' => 'sending',
            'filters' => $request->filters,
        ]);

        $sentCount = 0;
        $failedCount = 0;

        foreach ($channels as $channel) {
            // Replace placeholders in message
            $personalMessage = $this->replacePlaceholders($request->message, $channel);

            $result = $wa->send($channel->phone, $personalMessage);

            $blast->recipients()->create([
                'channel_id' => $channel->id,
                'phone' => $channel->phone,
                'status' => $result['success'] ? 'sent' : 'failed',
                'error' => $result['error'] ?? null,
                'sent_at' => $result['success'] ? now() : null,
            ]);

            if ($result['success']) {
                $sentCount++;
            } else {
                $failedCount++;
            }

            // Delay between messages to avoid rate limiting
            usleep(500000); // 0.5 second
        }

        $blast->update([
            'sent_count' => $sentCount,
            'failed_count' => $failedCount,
            'status' => $failedCount === $channels->count() ? 'failed' : 'completed',
        ]);

        return back()->with('success', "Blast selesai: {$sentCount} terkirim, {$failedCount} gagal.");
    }

    public function show(WaBlast $waBlast): Response
    {
        $waBlast->load([
            'user:id,name',
            'recipients.channel:id,channel_code,company_name',
        ]);

        return Inertia::render('WaBlast/Show', [
            'blast' => $waBlast,
        ]);
    }

    public function destroy(WaBlast $waBlast): RedirectResponse
    {
        $waBlast->delete();

        return back()->with('success', 'Blast history deleted.');
    }

    private function buildChannelQuery(Request $request)
    {
        $query = Channel::where('status', 'active')
            ->whereNotNull('phone')
            ->where('phone', '!=', '');

        $target = $request->input('target', 'all');

        if ($target === 'selected' && $request->channel_ids) {
            $query->whereIn('id', $request->channel_ids);
        } elseif ($target === 'filtered') {
            $filters = $request->input('filters', []);
            if (!empty($filters['province'])) {
                $query->where('province', $filters['province']);
            }
            if (!empty($filters['grade'])) {
                $query->where('channel_grade', $filters['grade']);
            }
        }

        return $query;
    }

    private function replacePlaceholders(string $message, Channel $channel): string
    {
        $greeting = $channel->gender === 'female' ? 'Ibu' : 'Bapak';
        $title = $channel->gender === 'female' ? 'Bu' : 'Pak';

        return str_replace(
            ['{company_name}', '{owner_name}', '{channel_code}', '{owner_title}', '{owner_greeting}'],
            [$channel->company_name, $channel->owner_name ?? '', $channel->channel_code, "{$title} {$channel->owner_name}", $greeting],
            $message
        );
    }
}
