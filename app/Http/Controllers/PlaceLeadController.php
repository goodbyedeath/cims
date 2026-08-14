<?php

declare(strict_types=1);

namespace App\Http\Controllers;

use App\Models\Channel;
use App\Services\GooglePlacesService;
use App\Services\WhatsAppService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

class PlaceLeadController extends Controller
{
    public function index(GooglePlacesService $places): Response
    {
        return Inertia::render('Leads/Index', [
            'configured' => $places->isConfigured(),
            'provider'   => $places->provider(),
            'quota'      => $places->quota(),
        ]);
    }

    public function search(Request $request, GooglePlacesService $places, WhatsAppService $wa): JsonResponse
    {
        $data = $request->validate([
            'keyword'   => ['required', 'string', 'min:2', 'max:100'],
            'region'    => ['nullable', 'string', 'max:100'],
            'pageToken' => ['nullable', 'string', 'max:500'],
        ]);

        if (! $places->isConfigured()) {
            return response()->json(['ok' => false, 'message' => 'API key belum dikonfigurasi (GOOGLE_MAPS_API_KEY atau SERPAPI_KEY).'], 422);
        }

        $query = trim($data['keyword']);
        if (! empty($data['region'])) {
            $query .= ' di ' . trim($data['region']);
        }

        try {
            $result = $places->searchText($query, $data['pageToken'] ?? null);
        } catch (\RuntimeException $e) {
            return response()->json(['ok' => false, 'message' => $e->getMessage()], 502);
        }

        // Match results against existing channels by normalized phone so the
        // table can badge places that are already in the pipeline.
        $phones = [];
        foreach ($result['places'] as $p) {
            if (! empty($p['nationalPhoneNumber'])) {
                $n        = $this->toIntl($wa->normalizePhone($p['nationalPhoneNumber']));
                $phones[] = $n;
                $phones[] = '0' . substr($n, 2);
            }
        }
        $existing = $phones
            ? Channel::whereIn('phone', $phones)->pluck('channel_code', 'phone')->all()
            : [];

        $leads = array_map(function (array $p) use ($wa, $existing) {
            $phone = ! empty($p['nationalPhoneNumber'])
                ? $this->toIntl($wa->normalizePhone($p['nationalPhoneNumber']))
                : null;

            $channelCode = null;
            if ($phone) {
                $channelCode = $existing[$phone] ?? $existing['0' . substr($phone, 2)] ?? null;
            }

            return [
                'place_id'     => $p['id'] ?? null,
                'name'         => $p['displayName']['text'] ?? '',
                'address'      => $p['formattedAddress'] ?? '',
                'phone'        => $phone,
                'lat'          => $p['location']['latitude'] ?? null,
                'lng'          => $p['location']['longitude'] ?? null,
                'map_url'      => $p['googleMapsUri'] ?? null,
                'website'      => $p['websiteUri'] ?? null,
                'rating'       => $p['rating'] ?? null,
                'reviews'      => $p['userRatingCount'] ?? null,
                'open'         => ($p['businessStatus'] ?? '') === 'OPERATIONAL',
                'channel_code' => $channelCode,
            ];
        }, $result['places']);

        return response()->json([
            'ok'            => true,
            'leads'         => $leads,
            'nextPageToken' => $result['nextPageToken'],
            'quota'         => $places->quota(),
        ]);
    }

    public function import(Request $request, WhatsAppService $wa): JsonResponse
    {
        $data = $request->validate([
            'name'    => ['required', 'string', 'max:255'],
            'address' => ['required', 'string', 'max:1000'],
            'phone'   => ['nullable', 'string', 'max:25'],
            'lat'     => ['nullable', 'numeric', 'between:-90,90'],
            'lng'     => ['nullable', 'numeric', 'between:-180,180'],
            'map_url' => ['nullable', 'string', 'max:4000'],
        ]);

        $phone = ! empty($data['phone']) ? $this->toIntl($wa->normalizePhone($data['phone'])) : null;

        if ($phone) {
            $variant  = '0' . substr($phone, 2);
            $existing = Channel::whereIn('phone', [$phone, $variant])->first();
            if ($existing) {
                return response()->json([
                    'ok'      => false,
                    'message' => "Sudah terdaftar sebagai channel {$existing->channel_code}.",
                ], 422);
            }
        }

        // Best-effort city/province from the formatted address tail
        // ("..., Kec. X, Kota Semarang, Jawa Tengah 50241, Indonesia").
        $parts    = array_values(array_filter(array_map('trim', explode(',', $data['address']))));
        if (end($parts) === 'Indonesia') {
            array_pop($parts);
        }
        $province = count($parts) >= 2 ? preg_replace('/\s+\d{5}$/', '', (string) end($parts)) : '-';
        $city     = count($parts) >= 3 ? $parts[count($parts) - 2] : '-';

        $channel = Channel::create([
            'channel_code' => $this->generateUniqueCode(),
            'company_name' => $data['name'],
            'owner_name'   => '-', // unknown from Maps — fill in during verification
            'phone'        => $phone ?? '',
            'address'      => $data['address'],
            'city'         => $city,
            'province'     => $province,
            'latitude'     => $data['lat'] ?? null,
            'longitude'    => $data['lng'] ?? null,
            'map_url'      => $data['map_url'] ?? null,
            // Prospect — pending outreach and verification by the team.
            'status'       => 'inactive',
        ]);

        return response()->json(['ok' => true, 'channel_code' => $channel->channel_code, 'id' => $channel->id]);
    }

    /**
     * WhatsAppService::normalizePhone only converts 08xx mobiles to 62 —
     * Maps results include landlines (e.g. "(024) 8412345" → "0248412345"),
     * which need the same 62 prefix for valid wa.me links and consistent dedup.
     */
    private function toIntl(string $phone): string
    {
        return str_starts_with($phone, '0') ? '62' . substr($phone, 1) : $phone;
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
