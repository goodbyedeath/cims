<?php

declare(strict_types=1);

namespace App\Http\Controllers;

use App\Http\Requests\ChannelRequest;
use App\Imports\ChannelDebugImport;
use App\Imports\ChannelImport;
use App\Models\Channel;
use App\Models\ChannelLog;
use App\Models\User;
use App\Notifications\NewChannelNotification;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Http;
use Inertia\Inertia;
use Inertia\Response;
use Maatwebsite\Excel\Facades\Excel;

class ChannelController extends Controller
{
    public function index(Request $request): Response
    {
        $filters = $request->only(['search', 'status', 'grade', 'province', 'sort_by', 'sort_dir']);

        $sortable = ['company_name', 'performance_score', 'channel_code', 'status', 'created_at'];
        $sortBy   = in_array($filters['sort_by'] ?? '', $sortable, true) ? $filters['sort_by'] : 'performance_score';
        $sortDir  = ($filters['sort_dir'] ?? 'desc') === 'asc' ? 'asc' : 'desc';

        $channels = Channel::query()

            ->when($filters['search'] ?? null, function ($query, $search) {
                $query->where(function ($q) use ($search) {
                    $q->where('company_name', 'like', "%{$search}%")
                      ->orWhere('channel_code', 'like', "%{$search}%")
                      ->orWhere('owner_name', 'like', "%{$search}%");
                });
            })
            ->when($filters['status'] ?? null, fn ($q, $status) => $q->where('status', $status))
            ->when($filters['grade'] ?? null, fn ($q, $grade) => $q->where('channel_grade', $grade))
            ->when($filters['province'] ?? null, fn ($q, $province) => $q->where('province', $province))
            ->orderBy($sortBy, $sortDir)
            ->paginate(15)
            ->withQueryString();

        $provinces = Channel::distinct()->pluck('province')->filter()->sort()->values();

        $noCoords = Channel::whereNull('latitude')
            ->whereNotNull('city')
            ->where('city', '!=', '')
            ->count();

        return Inertia::render('Channels/Index', [
            'channels'       => $channels,
            'filters'        => $filters,
            'provinces'      => $provinces,
            'hasGoogleSheet' => !empty(config('services.google_sheet.channel_id')),
            'noCoordsCount'  => $noCoords,
        ]);
    }

    public function syncGoogleSheet(): RedirectResponse
    {
        $sheetId = config('services.google_sheet.channel_id');

        if (empty($sheetId)) {
            return back()->with('error', 'Google Sheet ID not configured.');
        }

        $url = "https://docs.google.com/spreadsheets/d/{$sheetId}/export?format=csv";

        try {
            $response = Http::timeout(30)->get($url);

            if (!$response->successful()) {
                return back()->with('error', 'Failed to fetch Google Sheet. Make sure it is shared publicly.');
            }

            // The sheet has no header row — prepend one so ChannelImport can map columns
            $header = "channel_code,company_name,owner_name,purchasing_staff,phone,email,address,province,city,district,latitude,longitude,assigned_sales,status\n";
            $tmpPath = sys_get_temp_dir() . '/channel_sheet_' . uniqid() . '.csv';
            file_put_contents($tmpPath, $header . $response->body());

            set_time_limit(0);

            $import = new ChannelImport();
            Excel::import($import, $tmpPath, null, \Maatwebsite\Excel\Excel::CSV);

            @unlink($tmpPath);

            return back()->with('success', $this->syncSummary('Google Sheet sync complete', $import));
        } catch (\Exception $e) {
            return back()->with('error', 'Sync failed: ' . $e->getMessage());
        }
    }

    public function create(): Response
    {
        $users = User::where('status', 'active')
            ->whereIn('role', ['spv', 'downline'])
            ->get(['id', 'name', 'role']);

        return Inertia::render('Channels/Form', [
            'channel' => null,
            'users' => $users,
            'suggestedCode' => $this->generateUniqueCode(),
        ]);
    }

    public function generateCode(): \Illuminate\Http\JsonResponse
    {
        return response()->json(['code' => $this->generateUniqueCode()]);
    }

    private function generateUniqueCode(): string
    {
        do {
            $number = str_pad((string) random_int(1, 9999), 4, '0', STR_PAD_LEFT);
            $code = 'CH-' . $number;
        } while (Channel::withTrashed()->where('channel_code', $code)->exists());

        return $code;
    }

    public function store(ChannelRequest $request): RedirectResponse
    {
        $channel = Channel::create($request->validated());

        ChannelLog::create([
            'channel_id' => $channel->id,
            'user_id' => Auth::id(),
            'activity' => 'Channel created',
            'created_at' => now(),
        ]);

        // Notify all users about new channel
        $users = User::all();
        foreach ($users as $user) {
            $user->notify(new NewChannelNotification($channel));
        }

        return redirect()->route('channels.show', $channel)
            ->with('success', 'Channel created successfully.');
    }

    public function show(Channel $channel): Response
    {
        $channel->load([
            'assignedUser:id,name,role',
            'aiScore',
            'orders' => fn ($q) => $q->with('payment:id,order_id,payment_status')
                ->latest('order_date')
                ->limit(20),
            'logs.user:id,name',
        ]);

        return Inertia::render('Channels/Show', [
            'channel' => $channel,
        ]);
    }

    public function edit(Channel $channel): Response
    {
        $users = User::where('status', 'active')
            ->whereIn('role', ['spv', 'downline'])
            ->get(['id', 'name', 'role']);

        return Inertia::render('Channels/Form', [
            'channel' => $channel,
            'users' => $users,
        ]);
    }

    public function update(ChannelRequest $request, Channel $channel): RedirectResponse
    {
        $channel->update($request->validated());

        ChannelLog::create([
            'channel_id' => $channel->id,
            'user_id' => Auth::id(),
            'activity' => 'Channel updated',
            'created_at' => now(),
        ]);

        return redirect()->route('channels.show', $channel)
            ->with('success', 'Channel updated successfully.');
    }

    public function destroy(Channel $channel): RedirectResponse
    {
        $channel->delete();

        return redirect()->route('channels.index')
            ->with('success', 'Channel deleted successfully.');
    }

    public function toggleEmailInvalid(Channel $channel): \Illuminate\Http\JsonResponse
    {
        $channel->email_invalid = ! $channel->email_invalid;
        $channel->save();

        return response()->json([
            'email_invalid' => $channel->email_invalid,
            'message'       => $channel->email_invalid
                ? 'Email marked as invalid — will be skipped in future blasts.'
                : 'Email marked as valid again.',
        ]);
    }

    public function toggleUnsubscribed(Channel $channel): \Illuminate\Http\JsonResponse
    {
        $channel->email_unsubscribed    = ! $channel->email_unsubscribed;
        $channel->email_unsubscribed_at = $channel->email_unsubscribed ? now() : null;
        $channel->save();

        return response()->json([
            'email_unsubscribed' => $channel->email_unsubscribed,
            'message'            => $channel->email_unsubscribed
                ? 'Channel unsubscribed — excluded from future email blasts.'
                : 'Channel re-subscribed to email blasts.',
        ]);
    }

    public function import(Request $request): RedirectResponse
    {
        $request->validate([
            'file' => ['required', 'file', 'mimes:xlsx,xls'],
        ]);

        try {
            set_time_limit(0); // Allow long-running geocode requests

            $import = new ChannelImport();
            Excel::import($import, $request->file('file'));

            return back()->with('success', $this->syncSummary('Import selesai', $import));
        } catch (\Exception $e) {
            return back()->with('error', 'Import gagal: ' . $e->getMessage());
        }
    }

    public function destroyAll(Request $request): RedirectResponse
    {
        if (!Hash::check($request->input('password', ''), Auth::user()->password)) {
            return back()->withErrors(['password' => 'Password salah.']);
        }

        $count = Channel::count();

        DB::statement('SET FOREIGN_KEY_CHECKS=0');
        Channel::query()->forceDelete();
        DB::statement('SET FOREIGN_KEY_CHECKS=1');

        return back()->with('success', "Semua {$count} channel berhasil dihapus.");
    }

    public function bulkGeocode(): JsonResponse
    {
        set_time_limit(90);

        $batchSize = 8;

        $needsGeocode = fn ($q) => $q->whereNull('latitude')
            ->whereNotNull('city')
            ->where('city', '!=', '');

        $channels = Channel::where($needsGeocode)
            ->orderBy('id')
            ->take($batchSize)
            ->get(['id', 'city', 'province']);

        $geocodeCache = [];
        $updated = 0;
        $skipped = 0;

        foreach ($channels as $channel) {
            $city     = trim($channel->city ?? '');
            $province = trim($channel->province ?? '');
            $cacheKey = strtolower("{$city}|{$province}");

            if (!array_key_exists($cacheKey, $geocodeCache)) {
                usleep(1100000); // Nominatim: 1 req/s
                try {
                    $q        = implode(', ', array_filter([$city, $province, 'Indonesia']));
                    $response = Http::withHeaders(['Accept-Language' => 'id'])
                        ->timeout(10)
                        ->get('https://nominatim.openstreetmap.org/search', [
                            'q'      => $q,
                            'format' => 'json',
                            'limit'  => 1,
                        ]);
                    $results              = $response->json();
                    $geocodeCache[$cacheKey] = !empty($results)
                        ? ['lat' => (float) $results[0]['lat'], 'lon' => (float) $results[0]['lon']]
                        : null;
                } catch (\Exception) {
                    $geocodeCache[$cacheKey] = null;
                }
            }

            if ($geocodeCache[$cacheKey] !== null) {
                $channel->update([
                    'latitude'  => $geocodeCache[$cacheKey]['lat'],
                    'longitude' => $geocodeCache[$cacheKey]['lon'],
                ]);
                $updated++;
            } else {
                $skipped++;
            }
        }

        $remaining = Channel::where($needsGeocode)->count();

        return response()->json([
            'updated'   => $updated,
            'skipped'   => $skipped,
            'processed' => $channels->count(),
            'remaining' => $remaining,
            'done'      => $remaining === 0 || $channels->isEmpty(),
        ]);
    }

    private function syncSummary(string $prefix, ChannelImport $import): string
    {
        $parts = [];

        if ($import->getImportedCount() > 0)  $parts[] = "{$import->getImportedCount()} baru";
        if ($import->getUpdatedCount() > 0)    $parts[] = "{$import->getUpdatedCount()} diupdate";
        if ($import->getUnchangedCount() > 0)  $parts[] = "{$import->getUnchangedCount()} tidak berubah";
        if ($import->getSkippedCount() > 0)    $parts[] = "{$import->getSkippedCount()} dilewati";

        $summary = empty($parts) ? 'Tidak ada data yang diproses.' : implode(', ', $parts) . '.';

        return "{$prefix}: {$summary}";
    }
}
