<?php

declare(strict_types=1);

namespace App\Imports;

use App\Models\Channel;
use Illuminate\Support\Facades\Http;
use Maatwebsite\Excel\Concerns\ToModel;
use Maatwebsite\Excel\Concerns\WithHeadingRow;
use Maatwebsite\Excel\Concerns\SkipsEmptyRows;

class ChannelImport implements ToModel, WithHeadingRow, SkipsEmptyRows
{
    private int $imported  = 0;
    private int $updated   = 0;
    private int $unchanged = 0;
    private int $skipped   = 0;
    private array $geocodeCache = [];

    // Geocoding is disabled for bulk import/sync — it does usleep(1.1s) per
    // unique city and will hit the web server timeout on large sheets.
    public function __construct(private bool $enableGeocode = false) {}

    public function model(array $row): ?Channel
    {
        $channelCode = $this->str($row['channel_code'] ?? null);
        $companyName = $this->str($row['company_name'] ?? null);

        if (empty($companyName)) {
            $this->skipped++;
            return null;
        }

        // Track whether the sheet supplied a code — affects fallback lookup below
        $sheetHasCode = !empty($channelCode);

        if (!$sheetHasCode) {
            $channelCode = $this->generateChannelCode($companyName);
        }

        $rawAddress = $this->str($row['address'] ?? null) ?: '';
        $province   = $this->str($row['province'] ?? null);
        $city       = $this->str($row['city'] ?? null);
        $district   = $this->str($row['district'] ?? null);

        if (empty($province) && empty($city) && $rawAddress) {
            $parsed     = $this->parseAddress($rawAddress);
            $rawAddress = $parsed['address'];
            $province   = $parsed['province'];
            $city       = $parsed['city'];
            $district   = $parsed['district'] ?: $district;
        }

        $phone = $this->str($row['phone'] ?? null);
        if ($phone !== null) {
            $phone = preg_replace('/[^0-9+]/', '', $phone);
            if (str_starts_with($phone, '0')) {
                $phone = '62' . substr($phone, 1);
            }
            if (!str_starts_with($phone, '62') && !str_starts_with($phone, '+62')) {
                $phone = '62' . $phone;
            }
        }

        $data = [
            'company_name'     => $companyName,
            'owner_name'       => $this->str($row['owner_name'] ?? null) ?: '',
            'gender'           => $this->parseGender($this->str($row['gender'] ?? null)),
            'purchasing_staff' => $this->str($row['purchasing_staff'] ?? null),
            'phone'            => $phone,
            'email'            => $this->str($row['email'] ?? null),
            'address'          => $rawAddress,
            'province'         => $province ?: '',
            'city'             => $city ?: '',
            'district'         => $district,
            'latitude'         => $this->nullableFloat($row['latitude'] ?? null),
            'longitude'        => $this->nullableFloat($row['longitude'] ?? null),
            'status'           => $this->parseStatus($this->str($row['status'] ?? null)),
        ];

        // blacklist_reason — only overwrite DB if the column is present in the sheet
        if (array_key_exists('blacklist_reason', $row)) {
            $data['blacklist_reason'] = $this->str($row['blacklist_reason'] ?? null);
        }

        // Auto-geocode only when enabled (disabled by default for bulk sync to avoid timeouts)
        if ($this->enableGeocode && empty($data['latitude']) && !empty($data['city'])) {
            $coords = $this->geocode($data['city'], $data['province']);
            if ($coords) {
                $data['latitude']  = $coords['lat'];
                $data['longitude'] = $coords['lon'];
            }
        }

        // Primary lookup: by channel_code
        $existing = Channel::withTrashed()->where('channel_code', $channelCode)->first();

        // Fallback: sheet had no channel_code — match by company name to prevent
        // duplicates on every sync (generateChannelCode() produces a new random
        // code each call, so the primary lookup would never match existing rows).
        if (!$existing && !$sheetHasCode) {
            $existing = Channel::withTrashed()
                ->whereRaw('LOWER(company_name) = ?', [mb_strtolower($companyName)])
                ->first();
            if ($existing) {
                // Keep the DB's existing code; don't overwrite it with the generated one
                $channelCode = $existing->channel_code;
            }
        }

        if ($existing) {
            $wasTrashed = $existing->trashed();
            if ($wasTrashed) {
                $existing->restore();
            }

            $existing->fill($data);

            if ($wasTrashed || $existing->isDirty()) {
                $existing->save();
                $this->updated++;
            } else {
                $this->unchanged++;
            }

            return null;
        }

        $this->imported++;
        return new Channel(array_merge(['channel_code' => $channelCode], $data));
    }

    public function getImportedCount(): int  { return $this->imported;  }
    public function getUpdatedCount(): int   { return $this->updated;   }
    public function getUnchangedCount(): int { return $this->unchanged; }
    public function getSkippedCount(): int   { return $this->skipped;   }

    private function parseAddress(string $full): array
    {
        $parts  = array_values(array_filter(array_map('trim', explode(',', $full))));
        $result = ['address' => $full, 'district' => null, 'city' => null, 'province' => null];

        if (count($parts) >= 4) {
            $result['province'] = $parts[count($parts) - 1];
            $result['city']     = $parts[count($parts) - 2];
            $result['district'] = $parts[count($parts) - 3];
            $result['address']  = implode(', ', array_slice($parts, 0, count($parts) - 3));
        } elseif (count($parts) === 3) {
            $result['province'] = $parts[2];
            $result['city']     = $parts[1];
            $result['address']  = $parts[0];
        } elseif (count($parts) === 2) {
            $result['city']    = $parts[1];
            $result['address'] = $parts[0];
        }

        return $result;
    }

    private function generateChannelCode(string $companyName): string
    {
        $words    = preg_split('/[\s,.\-]+/', $companyName);
        $initials = '';
        foreach ($words as $word) {
            $word = trim($word);
            if ($word !== '' && !in_array(strtolower($word), ['pt', 'cv', 'ud', 'tb', 'pd'])) {
                $initials .= strtoupper(mb_substr($word, 0, 1));
            }
            if (strlen($initials) >= 3) break;
        }
        if (strlen($initials) < 2) {
            $initials = strtoupper(mb_substr(preg_replace('/[^a-zA-Z]/', '', $companyName), 0, 3));
        }

        $base = 'CH-' . $initials;
        $code = $base . '-' . str_pad((string) mt_rand(1, 999), 3, '0', STR_PAD_LEFT);

        while (Channel::withTrashed()->where('channel_code', $code)->exists()) {
            $code = $base . '-' . str_pad((string) mt_rand(1, 999), 3, '0', STR_PAD_LEFT);
        }

        return $code;
    }

    private function geocode(string $city, ?string $province): ?array
    {
        $cacheKey = strtolower($city . '|' . ($province ?? ''));

        if (array_key_exists($cacheKey, $this->geocodeCache)) {
            return $this->geocodeCache[$cacheKey];
        }

        try {
            $query = implode(', ', array_filter([$city, $province, 'Indonesia']));
            usleep(1100000); // Nominatim rate limit: 1 req/s

            $response = Http::withHeaders(['Accept-Language' => 'id'])
                ->get('https://nominatim.openstreetmap.org/search', [
                    'q'      => $query,
                    'format' => 'json',
                    'limit'  => 1,
                ]);

            $results = $response->json();

            $this->geocodeCache[$cacheKey] = !empty($results)
                ? ['lat' => (float) $results[0]['lat'], 'lon' => (float) $results[0]['lon']]
                : null;
        } catch (\Exception) {
            $this->geocodeCache[$cacheKey] = null;
        }

        return $this->geocodeCache[$cacheKey];
    }

    private function str(mixed $value): ?string
    {
        if ($value === null) return null;
        $s = trim((string) $value);
        return $s === '' ? null : $s;
    }

    private function nullableFloat(mixed $value): ?float
    {
        if ($value === null || trim((string) $value) === '') return null;
        return (float) $value;
    }

    private function parseGender(?string $value): ?string
    {
        if ($value === null) return null;

        return match (strtolower($value)) {
            'male', 'laki-laki', 'laki', 'l', 'pak', 'pria' => 'male',
            'female', 'perempuan', 'wanita', 'p', 'bu', 'ibu' => 'female',
            default => null,
        };
    }

    private function parseStatus(?string $value): string
    {
        if ($value === null) return 'active';

        return match (strtolower($value)) {
            'active', 'inactive', 'blacklist' => strtolower($value),
            'aktif'                            => 'active',
            'nonaktif', 'non-aktif', 'tidak aktif' => 'inactive',
            default => 'active',
        };
    }
}
