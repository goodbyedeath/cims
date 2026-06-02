<?php

declare(strict_types=1);

namespace App\Http\Controllers;

use App\Exports\ProductCatalogExport;
use App\Imports\ProductCatalogImport;
use App\Models\CatalogBrand;
use App\Models\CatalogSetting;
use App\Models\ProductCatalog;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Storage;
use Inertia\Inertia;
use Inertia\Response;
use Maatwebsite\Excel\Facades\Excel;
use Symfony\Component\HttpFoundation\BinaryFileResponse;

class ProductCatalogController extends Controller
{
    // ─── Helpers ─────────────────────────────────────────────────────────────

    private function brandsMap(): array
    {
        return CatalogBrand::all()
            ->keyBy('name')
            ->map(fn ($b) => $b->logo_url)
            ->toArray();
    }

    // ─── Admin CRUD ───────────────────────────────────────────────────────────

    public function index(Request $request): Response
    {
        $filters = $request->only(['search', 'category', 'status', 'sort_by', 'sort_dir']);

        $sortable = ['product_name', 'brand', 'category', 'best_price', 'moq', 'sort_order', 'created_at'];
        $userSort = in_array($filters['sort_by'] ?? '', $sortable, true);
        $sortBy   = $userSort ? $filters['sort_by'] : 'sort_order';
        $sortDir  = ($filters['sort_dir'] ?? 'desc') === 'asc' ? 'asc' : 'desc';
        // Default view keeps the historical "sort_order asc, then latest" ordering.
        // When the user picks a column, honour just that column.
        if (!$userSort) {
            $sortBy  = 'sort_order';
            $sortDir = 'asc';
        }

        $catalogs = ProductCatalog::query()
            ->when($filters['search'] ?? null, function ($query, $search) {
                $query->where(function ($q) use ($search) {
                    $q->where('brand', 'like', "%{$search}%")
                        ->orWhere('category', 'like', "%{$search}%")
                        ->orWhere('product_name', 'like', "%{$search}%");
                });
            })
            ->when($filters['category'] ?? null, fn ($q, $cat) => $q->where('category', $cat))
            ->when($filters['status'] ?? null, fn ($q, $s) => $q->where('status', $s))
            ->when(!$userSort, fn ($q) => $q->orderBy('sort_order')->latest())
            ->when($userSort, fn ($q) => $q->orderBy($sortBy, $sortDir))
            ->paginate(20)
            ->withQueryString();

        $categories = ProductCatalog::query()->select('category')->distinct()->orderBy('category')->pluck('category');

        $productBrands = ProductCatalog::query()->select('brand')->distinct()->orderBy('brand')->pluck('brand');
        $brands = CatalogBrand::orderBy('name')->get()->map(fn ($b) => [
            'id'       => $b->id,
            'name'     => $b->name,
            'logo_url' => $b->logo_url,
        ]);

        $brandNames = $brands->pluck('name')->all();
        $extra = $productBrands->reject(fn ($n) => in_array($n, $brandNames, true))
            ->map(fn ($n) => ['id' => null, 'name' => $n, 'logo_url' => null]);

        $allBrands = $brands->concat($extra)->sortBy('name')->values();

        return Inertia::render('Catalog/Index', [
            'catalogs'       => $catalogs,
            'filters'        => $filters,
            'categories'     => $categories,
            'brands'         => $allBrands,
            'brandsMap'      => $this->brandsMap(),
            'partnerPin'     => CatalogSetting::getValue('partner_pin'),
            'hasGoogleSheet' => !empty(config('services.google_sheet.catalog_id')),
        ]);
    }

    public function store(Request $request): RedirectResponse
    {
        $validated = $request->validate([
            'brand'        => ['required', 'string', 'max:100'],
            'category'     => ['required', 'string', 'max:100'],
            'product_name' => ['required', 'string', 'max:255'],
            'description'  => ['nullable', 'string'],
            'best_price'   => ['required', 'numeric', 'min:0'],
            'moq'          => ['required', 'integer', 'min:1'],
            'status'       => ['required', 'in:active,inactive'],
            'stock_status' => ['required', 'in:ready,indent'],
            'sort_order'   => ['nullable', 'integer', 'min:0'],
            'image'        => ['nullable', 'image', 'mimes:jpeg,png,jpg,webp', 'max:5120'],
        ]);

        if ($request->hasFile('image')) {
            $validated['image_path'] = $request->file('image')->store('catalog', 'public');
        }

        unset($validated['image']);
        ProductCatalog::create($validated);

        return back()->with('success', 'Product created successfully.');
    }

    public function update(Request $request, ProductCatalog $catalog): RedirectResponse
    {
        $validated = $request->validate([
            'brand'        => ['required', 'string', 'max:100'],
            'category'     => ['required', 'string', 'max:100'],
            'product_name' => ['required', 'string', 'max:255'],
            'description'  => ['nullable', 'string'],
            'best_price'   => ['required', 'numeric', 'min:0'],
            'moq'          => ['required', 'integer', 'min:1'],
            'status'       => ['required', 'in:active,inactive'],
            'stock_status' => ['required', 'in:ready,indent'],
            'sort_order'   => ['nullable', 'integer', 'min:0'],
            'image'        => ['nullable', 'image', 'mimes:jpeg,png,jpg,webp', 'max:5120'],
        ]);

        if ($request->hasFile('image')) {
            if ($catalog->image_path && Storage::disk('public')->exists($catalog->image_path)) {
                Storage::disk('public')->delete($catalog->image_path);
            }
            $validated['image_path'] = $request->file('image')->store('catalog', 'public');
        }

        unset($validated['image']);
        $catalog->update($validated);

        return back()->with('success', 'Product updated successfully.');
    }

    public function destroy(ProductCatalog $catalog): RedirectResponse
    {
        if ($catalog->image_path && Storage::disk('public')->exists($catalog->image_path)) {
            Storage::disk('public')->delete($catalog->image_path);
        }

        $catalog->delete();

        return back()->with('success', 'Product deleted successfully.');
    }

    // ─── Google Sheet sync ───────────────────────────────────────────────────

    public function syncGoogleSheet(): RedirectResponse
    {
        $sheetId = config('services.google_sheet.catalog_id');

        if (empty($sheetId)) {
            return back()->with('error', 'Google Sheet ID not configured.');
        }

        $url = "https://docs.google.com/spreadsheets/d/{$sheetId}/export?format=csv";

        try {
            $response = Http::timeout(30)->get($url);

            if (!$response->successful()) {
                return back()->with('error', 'Failed to fetch Google Sheet. Make sure it is shared publicly (Anyone with link can view).');
            }

            if (strlen(trim($response->body())) < 10) {
                return back()->with('error', 'Google Sheet appears to be empty.');
            }

            $tmpPath = sys_get_temp_dir() . '/catalog_sheet_' . uniqid() . '.csv';
            file_put_contents($tmpPath, $response->body());

            set_time_limit(0);

            $import = new ProductCatalogImport();
            Excel::import($import, $tmpPath, null, \Maatwebsite\Excel\Excel::CSV);

            @unlink($tmpPath);

            $created = $import->getCreatedCount();
            $updated = $import->getUpdatedCount();
            $skipped = $import->getSkippedCount();

            $msg = "Google Sheet sync complete: {$created} created, {$updated} updated";
            if ($skipped > 0) {
                $msg .= ", {$skipped} skipped";
            }

            return back()->with('success', $msg);
        } catch (\Exception $e) {
            return back()->with('error', 'Sync failed: ' . $e->getMessage());
        }
    }

    // ─── XLSX Export / Import ─────────────────────────────────────────────────

    public function export(): BinaryFileResponse
    {
        $filename = 'product-catalog-' . now()->format('Y-m-d') . '.xlsx';
        return Excel::download(new ProductCatalogExport(), $filename);
    }

    // ─── Brand logo management ────────────────────────────────────────────────

    public function storeBrand(Request $request): RedirectResponse
    {
        $request->validate([
            'name' => ['required', 'string', 'max:100'],
            'logo' => ['required', 'image', 'mimes:jpeg,png,jpg,webp,svg', 'max:2048'],
        ]);

        $brand = CatalogBrand::firstOrNew(['name' => $request->input('name')]);

        if ($brand->logo_path && Storage::disk('public')->exists($brand->logo_path)) {
            Storage::disk('public')->delete($brand->logo_path);
        }

        $brand->logo_path = $request->file('logo')->store('catalog/brands', 'public');
        $brand->save();

        return back()->with('success', 'Brand logo saved.');
    }

    public function destroyBrand(Request $request): RedirectResponse
    {
        $request->validate(['name' => ['required', 'string', 'max:100']]);

        $brand = CatalogBrand::where('name', $request->input('name'))->first();

        if ($brand) {
            if ($brand->logo_path && Storage::disk('public')->exists($brand->logo_path)) {
                Storage::disk('public')->delete($brand->logo_path);
            }
            $brand->delete();
        }

        return back()->with('success', 'Brand logo removed.');
    }

    // ─── Partner PIN management ───────────────────────────────────────────────

    public function generatePin(): RedirectResponse
    {
        $pin = str_pad((string) random_int(1000, 9999), 4, '0', STR_PAD_LEFT);
        CatalogSetting::setValue('partner_pin', $pin);

        return back()->with('success', "PIN partner baru: {$pin}");
    }

    public function clearPin(): RedirectResponse
    {
        CatalogSetting::forgetValue('partner_pin');

        return back()->with('success', 'PIN partner dihapus. Harga kini terkunci tanpa akses.');
    }

    // ─── Public view ─────────────────────────────────────────────────────────

    public function publicView(Request $request): Response
    {
        $partnerPin    = CatalogSetting::getValue('partner_pin');
        $priceUnlocked = (bool) $request->session()->get('catalog_partner_auth');

        $products = ProductCatalog::query()
            ->where('status', 'active')
            ->orderBy('sort_order')
            ->latest()
            ->get();

        $brandLogos = $this->brandsMap();

        $mapped = $products->map(fn ($item) => [
            'brand'        => $item->brand,
            'category'     => $item->category,
            'product_name' => $item->product_name,
            'description'  => $item->description,
            'best_price'   => $priceUnlocked ? $item->best_price : null,
            'moq'          => $item->moq,
            'image_url'    => $item->image_path ? Storage::url($item->image_path) : null,
            'brand_logo'   => $brandLogos[$item->brand] ?? null,
            'stock_status' => $item->stock_status,
        ]);

        $categories = $mapped->pluck('category')->unique()->values();

        $brandsList = $products
            ->groupBy('brand')
            ->map(fn ($group, $name) => [
                'name'  => $name,
                'logo'  => $brandLogos[$name] ?? null,
                'count' => $group->count(),
            ])
            ->sortBy('name')
            ->values();

        return Inertia::render('Catalog/Public', [
            'products'      => $mapped,
            'categories'    => $categories,
            'brands'        => $brandsList,
            'priceUnlocked' => $priceUnlocked,
            'partnerPin'    => (bool) $partnerPin,
            'pinError'      => $request->session()->pull('catalog_pin_error'),
            'company'       => [
                'name'     => CatalogSetting::getValue('company_name', 'Component Sales'),
                'tagline'  => CatalogSetting::getValue('company_tagline', 'Sistem Integrator'),
                'logo_url' => (fn ($p) => $p ? \Illuminate\Support\Facades\Storage::disk('public')->url($p) : null)(
                    CatalogSetting::getValue('company_logo_path')
                ),
            ],
        ])->withViewData(['noindex' => true]);
    }

    public function publicVerify(Request $request): RedirectResponse
    {
        $request->validate(['pin' => ['required', 'string', 'max:10']]);

        $correct = CatalogSetting::getValue('partner_pin');

        if ($correct && hash_equals((string) $correct, (string) $request->input('pin'))) {
            $request->session()->regenerate();
            $request->session()->put('catalog_partner_auth', true);
            return redirect()->route('catalog.public');
        }

        $request->session()->put('catalog_pin_error', 'Kode akses salah. Silakan coba lagi.');
        return redirect()->route('catalog.public');
    }

    public function publicSignOut(Request $request): RedirectResponse
    {
        $request->session()->forget('catalog_partner_auth');
        return redirect()->route('catalog.public');
    }
}
