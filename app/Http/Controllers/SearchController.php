<?php

declare(strict_types=1);

namespace App\Http\Controllers;

use App\Models\CatalogSetting;
use App\Models\Inventory;
use App\Models\ProductCatalog;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\RateLimiter;
use Illuminate\Support\Facades\Storage;
use Inertia\Inertia;
use Inertia\Response;

class SearchController extends Controller
{
    private bool $priceUnlocked = false;

    // ─── PIN verify & sign-out ────────────────────────────────────────────────

    public function verifyPin(Request $request): RedirectResponse
    {
        $request->validate(['pin' => ['required', 'string', 'max:10']]);

        $throttleKey = 'pin-verify:' . $request->ip();
        if (RateLimiter::tooManyAttempts($throttleKey, 5)) {
            $request->session()->put('catalog_search_pin_error', 'Terlalu banyak percobaan. Coba lagi dalam 15 menit.');
            return back();
        }

        $correct = CatalogSetting::getValue('partner_pin');

        if ($correct && hash_equals((string) $correct, (string) $request->input('pin'))) {
            RateLimiter::clear($throttleKey);
            $request->session()->regenerate();
            $request->session()->put('catalog_partner_auth', true);
        } else {
            RateLimiter::hit($throttleKey, 900); // 15-minute window
            $request->session()->put('catalog_search_pin_error', 'Kode akses salah. Silakan coba lagi.');
        }

        return back();
    }

    public function signOut(Request $request): RedirectResponse
    {
        $request->session()->forget('catalog_partner_auth');
        return back();
    }

    // ─── Public entry point ───────────────────────────────────────────────────

    public function index(Request $request): Response
    {
        $query  = trim((string) ($request->input('q') ?? ''));
        $filter = in_array((string) ($request->input('filter') ?? 'all'), ['all', 'catalog', 'inventory'], true)
            ? (string) ($request->input('filter') ?? 'all')
            : 'all';
        $page    = max(1, (int) $request->input('page', 1));
        $perPage = (int) config('search.per_page', 15);

        $results    = [];
        $totalCount = 0;

        $this->priceUnlocked = (bool) $request->session()->get('catalog_partner_auth');
        $logoPath            = CatalogSetting::getValue('company_logo_path');

        if ($query !== '') {
            $all        = $this->runSearch($query, $filter);
            $totalCount = count($all);
            $results    = array_values(array_slice($all, ($page - 1) * $perPage, $perPage));
        }

        return Inertia::render('Search/Index', [
            'query'         => $query,
            'filter'        => $filter,
            'results'       => $results,
            'total'         => $totalCount,
            'perPage'       => $perPage,
            'currentPage'   => $page,
            'lastPage'      => $totalCount > 0 ? (int) ceil($totalCount / $perPage) : 1,
            'priceUnlocked' => $this->priceUnlocked,
            'partnerPin'    => !empty(CatalogSetting::getValue('partner_pin')),
            'pinError'      => $request->session()->pull('catalog_search_pin_error'),
            'company'       => [
                'name'    => CatalogSetting::getValue('company_name', 'Component Sales'),
                'tagline' => CatalogSetting::getValue('company_tagline', 'Sistem Integrator'),
                'logo_url'=> $logoPath ? Storage::disk('public')->url($logoPath) : null,
            ],
        ]);
    }

    // ─── Core search ─────────────────────────────────────────────────────────

    private function runSearch(string $query, string $filter): array
    {
        $results = [];

        if ($filter === 'all' || $filter === 'catalog') {
            foreach ($this->searchCatalog($query) as $hit) {
                $results[] = $hit;
            }
        }

        if ($filter === 'all' || $filter === 'inventory') {
            foreach ($this->searchInventory($query) as $hit) {
                $results[] = $hit;
            }
        }

        usort($results, fn ($a, $b) => $b['score'] <=> $a['score']);

        return $results;
    }

    // ─── Catalog search ───────────────────────────────────────────────────────

    private function searchCatalog(string $query): array
    {
        $boolQ = $this->toBooleanQuery($query);

        if ($boolQ !== '') {
            $rows = ProductCatalog::selectRaw(
                "id, uid, brand, category, product_name, description, best_price, moq, status, stock_status,
                (MATCH(product_name, brand, category)      AGAINST(? IN BOOLEAN MODE) * 2.0
               + MATCH(product_name, brand, category, description) AGAINST(? IN BOOLEAN MODE) * 1.0
                ) AS bm25_score",
                [$boolQ, $boolQ]
            )
                ->whereRaw(
                    'MATCH(product_name, brand, category, description) AGAINST(? IN BOOLEAN MODE)',
                    [$boolQ]
                )
                ->limit((int) config('search.max_per_entity', 50))
                ->get();
        } else {
            $rows = collect();
        }

        // LIKE fallback for very short terms or zero FULLTEXT hits
        if ($rows->isEmpty()) {
            $safe = $this->escapeLike($query);
            $rows = ProductCatalog::where('product_name', 'like', "%{$safe}%")
                ->orWhere('brand', 'like', "%{$safe}%")
                ->orWhere('category', 'like', "%{$safe}%")
                ->limit((int) config('search.max_per_entity', 50))
                ->get()
                ->map(function ($r) { $r->bm25_score = 0.5; return $r; });
        }

        return $rows
            ->values()
            ->map(fn ($row, $rank) => $this->mapCatalog($row, $rank, $query))
            ->toArray();
    }

    // ─── Inventory search ────────────────────────────────────────────────────

    private function searchInventory(string $query): array
    {
        $boolQ = $this->toBooleanQuery($query);

        if ($boolQ !== '') {
            $rows = Inventory::selectRaw(
                "id, sku_no, product, kode_barang, spesifikasi, notes, qty, srp, m1,
                (MATCH(product, sku_no, kode_barang)                AGAINST(? IN BOOLEAN MODE) * 2.0
               + MATCH(product, sku_no, kode_barang, spesifikasi, notes) AGAINST(? IN BOOLEAN MODE) * 1.0
                ) AS bm25_score",
                [$boolQ, $boolQ]
            )
                ->whereRaw(
                    'MATCH(product, sku_no, kode_barang, spesifikasi, notes) AGAINST(? IN BOOLEAN MODE)',
                    [$boolQ]
                )
                ->limit((int) config('search.max_per_entity', 50))
                ->get();
        } else {
            $rows = collect();
        }

        if ($rows->isEmpty()) {
            $safe = $this->escapeLike($query);
            $rows = Inventory::where('product', 'like', "%{$safe}%")
                ->orWhere('sku_no', 'like', "%{$safe}%")
                ->orWhere('kode_barang', 'like', "%{$safe}%")
                ->limit((int) config('search.max_per_entity', 50))
                ->get()
                ->map(function ($r) { $r->bm25_score = 0.5; return $r; });
        }

        return $rows
            ->values()
            ->map(fn ($row, $rank) => $this->mapInventory($row, $rank, $query))
            ->toArray();
    }

    // ─── Result mappers ───────────────────────────────────────────────────────

    private function mapCatalog(ProductCatalog $item, int $rank, string $query): array
    {
        $score = $this->finalScore(
            (float) $item->bm25_score,
            $rank,
            $query,
            (string) $item->product_name
        );

        return [
            'id'       => $item->id,
            'type'     => 'catalog',
            'title'    => $this->highlight((string) $item->product_name, $query),
            'subtitle' => implode(' · ', array_filter([(string) $item->brand, (string) $item->category])),
            'snippet'  => $this->excerpt((string) ($item->description ?? ''), $query, 160),
            'meta'     => [
                ['label' => 'Brand',    'value' => (string) $item->brand],
                ['label' => 'Kategori', 'value' => (string) $item->category],
                ['label' => 'MOQ',      'value' => (string) $item->moq . ' pcs'],
                [
                    'label'  => 'Harga',
                    'value'  => $this->priceUnlocked
                        ? 'Rp ' . number_format((float) $item->best_price, 0, ',', '.')
                        : null,
                    'locked' => !$this->priceUnlocked,
                ],
            ],
            'url'   => '/catalog?search=' . urlencode((string) $item->product_name),
            'score' => $score,
        ];
    }

    private function mapInventory(Inventory $item, int $rank, string $query): array
    {
        $score = $this->finalScore(
            (float) $item->bm25_score,
            $rank,
            $query,
            (string) $item->product
        );

        return [
            'id'       => $item->id,
            'type'     => 'inventory',
            'title'    => $this->highlight((string) $item->product, $query),
            'subtitle' => '',
            'snippet'  => $this->excerpt((string) ($item->spesifikasi ?? $item->notes ?? ''), $query, 160),
            'meta'     => [
                ['label' => 'Stock', 'value' => $item->qty <= 0 ? 'Stok Kosong' : ((string) $item->qty . ' pcs'), 'empty' => $item->qty <= 0],
                ['label' => 'Harga', 'value' => 'Rp ' . number_format((float) $item->m1, 0, ',', '.')],
            ],
            'url'   => '/inventory?search=' . urlencode((string) $item->product),
            'score' => $score,
        ];
    }

    // ─── Scoring helpers ──────────────────────────────────────────────────────

    private function finalScore(float $bm25Raw, int $rank, string $query, string $titleField): float
    {
        $w = config('search.weights');

        // Normalise MySQL BM25 score (scores vary; cap at 10 for normalisation)
        $bm25 = min(1.0, $bm25Raw / 10.0);

        // Rank decay: first result scores 1.0, decays with position
        $rankScore = 1.0 / (1.0 + 0.12 * $rank);

        // Title boost
        $queryLower = mb_strtolower($query);
        $titleLower = mb_strtolower($titleField);
        $boostCfg   = config('search.title_boost');
        $boost      = 1.0;
        if (str_starts_with($titleLower, $queryLower)) {
            $boost = (float) $boostCfg['prefix'];
        } elseif (str_contains($titleLower, $queryLower)) {
            $boost = (float) $boostCfg['contains'];
        }

        $score = ($w['bm25'] * $bm25 * $boost)
               + ($w['rank'] * $rankScore)
               + ($w['boost'] * ($boost - 1.0) * 0.5); // extra boost signal

        return round(min(1.0, $score), 4);
    }

    private function rankScore(int $rank): float
    {
        return 1.0 / (1.0 + 0.12 * $rank);
    }

    // ─── Text helpers ─────────────────────────────────────────────────────────

    /**
     * Wrap matched terms in <mark> tags.
     * Input is plain text from our own DB — strip_tags ensures no injection.
     */
    private function highlight(string $text, string $query): string
    {
        $text = strip_tags($text);

        foreach ($this->queryTerms($query) as $term) {
            $text = preg_replace(
                '/(' . preg_quote($term, '/') . ')/iu',
                '<mark>$1</mark>',
                $text
            );
        }

        return $text;
    }

    /**
     * Extract a relevant snippet around the first matched term, then highlight.
     */
    private function excerpt(string $text, string $query, int $maxLen): string
    {
        $text  = strip_tags($text);
        $lower = mb_strtolower($text);
        $start = 0;

        foreach ($this->queryTerms($query) as $term) {
            $pos = mb_strpos($lower, mb_strtolower($term));
            if ($pos !== false) {
                $start = max(0, $pos - 40);
                break;
            }
        }

        $excerpt = ($start > 0 ? '…' : '') . mb_substr($text, $start, $maxLen);
        if (mb_strlen($text) > $start + $maxLen) {
            $excerpt .= '…';
        }

        return $this->highlight($excerpt, $query);
    }

    /** Escape MySQL LIKE wildcards so user input is treated as a literal string. */
    private function escapeLike(string $value): string
    {
        return str_replace(['\\', '%', '_'], ['\\\\', '\\%', '\\_'], $value);
    }

    /** Convert search query to BOOLEAN MODE string with prefix wildcards. */
    private function toBooleanQuery(string $query): string
    {
        return collect(explode(' ', $query))
            ->map(fn ($t) => trim($t))
            ->filter(fn ($t) => mb_strlen($t) >= 3)
            ->map(function ($t) {
                $clean = preg_replace('/[+\-><()\~\*@"]+/', '', $t);
                return $clean !== '' ? "+{$clean}*" : null;
            })
            ->filter()
            ->implode(' ');
    }

    /** Split query into individual terms (min 2 chars) for highlighting. */
    private function queryTerms(string $query): array
    {
        return collect(explode(' ', $query))
            ->map(fn ($t) => trim($t))
            ->filter(fn ($t) => mb_strlen($t) >= 2)
            ->unique()
            ->values()
            ->toArray();
    }
}
