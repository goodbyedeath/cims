<?php

declare(strict_types=1);

namespace App\Services;

use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Http;

/**
 * Store search for /leads. Two interchangeable providers behind one API:
 * - google:  Places API (New) Text Search — official, needs billing-enabled key
 * - serpapi: serpapi.com google_maps engine — free 100 searches/month, no card
 * Provider is picked by which key is configured (Google wins when both are).
 * Both return the Places-API response shape, so the controller is provider-blind.
 */
class GooglePlacesService
{
    // Contact fields (phone/website) put the request in the Enterprise SKU —
    // ask for everything the leads table needs in one call.
    private const FIELD_MASK = 'places.id,places.displayName,places.formattedAddress,'
        . 'places.nationalPhoneNumber,places.internationalPhoneNumber,places.location,'
        . 'places.googleMapsUri,places.websiteUri,places.rating,places.userRatingCount,'
        . 'places.businessStatus,nextPageToken';

    public function provider(): ?string
    {
        if (! empty(config('services.google_maps.key'))) {
            return 'google';
        }
        if (! empty(config('services.serpapi.key'))) {
            return 'serpapi';
        }

        return null;
    }

    public function isConfigured(): bool
    {
        return $this->provider() !== null;
    }

    /**
     * Returns ['places' => [...], 'nextPageToken' => ?string] in the Places
     * API (New) shape regardless of provider. Identical query+page responses
     * are cached 24h so repeat searches don't burn quota/billing (Google ToS
     * allows caching up to 30 days).
     *
     * @throws \RuntimeException on API error or missing configuration
     */
    public function searchText(string $query, ?string $pageToken = null): array
    {
        $provider = $this->provider();
        if ($provider === null) {
            throw new \RuntimeException('No search provider configured.');
        }

        $cacheKey = "places_search:{$provider}:" . md5($query . '|' . ($pageToken ?? ''));

        return Cache::remember($cacheKey, now()->addDay(), fn () => $provider === 'google'
            ? $this->searchGoogle($query, $pageToken)
            : $this->searchSerpApi($query, $pageToken));
    }

    /**
     * SerpApi monthly quota — free Account API call, does not consume
     * searches. Cached 5 min; searchSerpApi busts the cache after every
     * live (uncached) search so the meter stays accurate.
     */
    public function quota(): ?array
    {
        if ($this->provider() !== 'serpapi') {
            return null;
        }

        return Cache::remember('serpapi_quota', now()->addMinutes(5), function () {
            $response = Http::timeout(10)->get('https://serpapi.com/account.json', [
                'api_key' => config('services.serpapi.key'),
            ]);

            if ($response->failed() || $response->json('error')) {
                return null;
            }

            return [
                'plan'  => $response->json('plan_name'),
                'total' => (int) $response->json('searches_per_month'),
                'left'  => (int) $response->json('total_searches_left'),
                'used'  => (int) $response->json('this_month_usage'),
            ];
        });
    }

    private function searchGoogle(string $query, ?string $pageToken): array
    {
        $body = [
            'textQuery'    => $query,
            'languageCode' => 'id',
            'regionCode'   => 'ID',
            'pageSize'     => 20,
        ];
        if ($pageToken) {
            $body['pageToken'] = $pageToken;
        }

        $response = Http::timeout(20)
            ->withHeaders([
                'X-Goog-Api-Key'   => config('services.google_maps.key'),
                'X-Goog-FieldMask' => self::FIELD_MASK,
            ])
            ->post('https://places.googleapis.com/v1/places:searchText', $body);

        if ($response->failed()) {
            $msg = $response->json('error.message') ?? ('HTTP ' . $response->status());
            throw new \RuntimeException('Places API: ' . $msg);
        }

        return [
            'places'        => $response->json('places') ?? [],
            'nextPageToken' => $response->json('nextPageToken'),
        ];
    }

    /**
     * SerpApi google_maps engine. pageToken carries the numeric "start"
     * offset (results come 20/page).
     */
    private function searchSerpApi(string $query, ?string $pageToken): array
    {
        $params = [
            'engine'  => 'google_maps',
            'type'    => 'search',
            'q'       => $query,
            'hl'      => 'id',
            'api_key' => config('services.serpapi.key'),
        ];
        $start = $pageToken !== null ? max(0, (int) $pageToken) : 0;
        if ($start > 0) {
            $params['start'] = $start;
        }

        $response = Http::timeout(45)->get('https://serpapi.com/search.json', $params);

        if ($response->failed() || $response->json('error')) {
            $msg = $response->json('error') ?? ('HTTP ' . $response->status());
            throw new \RuntimeException('SerpApi: ' . $msg);
        }

        $results = $response->json('local_results') ?? [];
        // A query matching one exact place returns a single place_results
        // object instead of the local_results list.
        if (! $results && $response->json('place_results')) {
            $results = [$response->json('place_results')];
        }

        $places = array_map(function (array $r) {
            $placeId = $r['place_id'] ?? null;

            return [
                'id'                  => $placeId ?? ($r['data_id'] ?? md5(($r['title'] ?? '') . ($r['address'] ?? ''))),
                'displayName'         => ['text' => $r['title'] ?? ''],
                'formattedAddress'    => $r['address'] ?? '',
                'nationalPhoneNumber' => $r['phone'] ?? null,
                'location'            => [
                    'latitude'  => $r['gps_coordinates']['latitude'] ?? null,
                    'longitude' => $r['gps_coordinates']['longitude'] ?? null,
                ],
                'googleMapsUri'       => $placeId
                    ? 'https://www.google.com/maps/place/?q=place_id:' . $placeId
                    : null,
                'websiteUri'          => $r['website'] ?? null,
                'rating'              => $r['rating'] ?? null,
                'userRatingCount'     => $r['reviews'] ?? null,
                'businessStatus'      => ($r['permanently_closed'] ?? false) ? 'CLOSED_PERMANENTLY' : 'OPERATIONAL',
            ];
        }, array_values($results));

        $hasNext = (bool) $response->json('serpapi_pagination.next');

        // A live search consumed quota — refresh the meter on next read.
        Cache::forget('serpapi_quota');

        return [
            'places'        => $places,
            'nextPageToken' => $hasNext ? (string) ($start + 20) : null,
        ];
    }
}
