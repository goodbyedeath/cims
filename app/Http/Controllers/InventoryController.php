<?php

declare(strict_types=1);

namespace App\Http\Controllers;

use App\Imports\InventoryImport;
use App\Models\CatalogSetting;
use App\Models\Inventory;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Http;
use Inertia\Inertia;
use Inertia\Response;
use Maatwebsite\Excel\Facades\Excel;

class InventoryController extends Controller
{
    public function index(Request $request): Response
    {
        $filters = $request->only(['search', 'sort_by', 'sort_dir']);

        $sortable = ['sku_no', 'product', 'kode_barang', 'qty', 'srp', 'm1', 'created_at'];
        $sortBy   = in_array($filters['sort_by'] ?? '', $sortable, true) ? $filters['sort_by'] : 'created_at';
        $sortDir  = ($filters['sort_dir'] ?? 'desc') === 'asc' ? 'asc' : 'desc';

        $inventories = Inventory::query()
            ->when($filters['search'] ?? null, function ($q, $search) {
                $q->where(function ($query) use ($search) {
                    $query->where('sku_no', 'like', "%{$search}%")
                        ->orWhere('product', 'like', "%{$search}%")
                        ->orWhere('kode_barang', 'like', "%{$search}%")
                        ->orWhere('spesifikasi', 'like', "%{$search}%");
                });
            })
            ->orderBy($sortBy, $sortDir)
            ->paginate(20)
            ->withQueryString();

        return Inertia::render('Inventory/Index', [
            'inventories'    => $inventories,
            'filters'        => $filters,
            'hasGoogleSheet' => !empty(config('services.google_sheet.inventory_id')),
            'srpFormula'     => [
                'type'  => CatalogSetting::getValue('srp_formula_type', 'subtract_percent'),
                'value' => (float) CatalogSetting::getValue('srp_formula_value', '20.5'),
            ],
        ]);
    }

    public function store(Request $request): RedirectResponse
    {
        $validated = $request->validate([
            'sku_no' => ['required', 'string', 'max:50', 'unique:inventories,sku_no'],
            'product' => ['required', 'string', 'max:255'],
            'kode_barang' => ['required', 'string', 'max:50'],
            'spesifikasi' => ['nullable', 'string'],
            'notes' => ['nullable', 'string'],
            'qty' => ['nullable', 'integer', 'min:0'],
            'srp' => ['required', 'numeric', 'min:0'],
            'm1' => ['required', 'numeric', 'min:0'],
        ]);

        Inventory::create($validated);

        return back()->with('success', 'Inventory item created successfully.');
    }

    public function update(Request $request, Inventory $inventory): RedirectResponse
    {
        $validated = $request->validate([
            'sku_no' => ['required', 'string', 'max:50', 'unique:inventories,sku_no,' . $inventory->id],
            'product' => ['required', 'string', 'max:255'],
            'kode_barang' => ['required', 'string', 'max:50'],
            'spesifikasi' => ['nullable', 'string'],
            'notes' => ['nullable', 'string'],
            'qty' => ['nullable', 'integer', 'min:0'],
            'srp' => ['required', 'numeric', 'min:0'],
            'm1' => ['required', 'numeric', 'min:0'],
        ]);

        $inventory->update($validated);

        return back()->with('success', 'Inventory item updated successfully.');
    }

    public function import(Request $request): RedirectResponse
    {
        $request->validate([
            'file' => ['required', 'file', 'mimes:xlsx,xls,csv', 'max:10240'],
        ]);

        set_time_limit(0);

        $import = new InventoryImport();
        Excel::import($import, $request->file('file'));

        return back()->with('success', $this->syncSummary('Import complete', $import));
    }

    public function syncGoogleSheet(): RedirectResponse
    {
        $sheetId = config('services.google_sheet.inventory_id');

        if (empty($sheetId)) {
            return back()->with('error', 'Google Sheet ID not configured.');
        }

        $url = "https://docs.google.com/spreadsheets/d/{$sheetId}/export?format=csv";

        try {
            $response = Http::timeout(30)->get($url);

            if (!$response->successful()) {
                return back()->with('error', 'Failed to fetch Google Sheet. Make sure it is shared publicly.');
            }

            if (strlen(trim($response->body())) < 10) {
                return back()->with('error', 'Google Sheet appears to be empty.');
            }

            $tmpPath = sys_get_temp_dir() . '/inventory_sheet_' . uniqid() . '.csv';
            file_put_contents($tmpPath, $response->body());

            set_time_limit(0);

            $import = new InventoryImport();
            Excel::import($import, $tmpPath, null, \Maatwebsite\Excel\Excel::CSV);

            @unlink($tmpPath);

            return back()->with('success', $this->syncSummary('Google Sheet sync complete', $import));
        } catch (\Exception $e) {
            return back()->with('error', 'Sync failed: ' . $e->getMessage());
        }
    }

    private function syncSummary(string $prefix, InventoryImport $import): string
    {
        $parts = [];

        if ($import->getImportedCount() > 0)  $parts[] = "{$import->getImportedCount()} new";
        if ($import->getUpdatedCount() > 0)    $parts[] = "{$import->getUpdatedCount()} updated";
        if ($import->getUnchangedCount() > 0)  $parts[] = "{$import->getUnchangedCount()} unchanged";
        if ($import->getSkippedCount() > 0)    $parts[] = "{$import->getSkippedCount()} skipped";

        $total = $import->getImportedCount() + $import->getUpdatedCount() + $import->getUnchangedCount();

        if ($total === 0 && $import->getSkippedCount() > 0) {
            return "{$prefix}: All rows were skipped — the SKU column header in your file is not recognised. "
                 . "Supported names: sku_no, sku, no_sku, kode_sku, sku_number, item_code, code.";
        }

        $summary = empty($parts) ? 'No data processed.' : implode(', ', $parts) . '.';

        return "{$prefix}: {$summary}";
    }

    public function saveSrpFormula(Request $request): RedirectResponse
    {
        $validated = $request->validate([
            'type'  => ['required', 'in:subtract_percent,add_percent,multiply,subtract_fixed'],
            'value' => ['required', 'numeric', 'min:0'],
        ]);

        CatalogSetting::setValue('srp_formula_type', $validated['type']);
        CatalogSetting::setValue('srp_formula_value', (string) $validated['value']);

        return back()->with('success', 'SRP formula saved successfully.');
    }

    public function destroyAll(): RedirectResponse
    {
        $count = Inventory::count();

        DB::statement('SET FOREIGN_KEY_CHECKS=0');
        Inventory::truncate();
        DB::statement('SET FOREIGN_KEY_CHECKS=1');

        return back()->with('success', "All {$count} inventory items have been removed.");
    }

    public function destroy(Inventory $inventory): RedirectResponse
    {
        $inventory->delete();

        return back()->with('success', 'Inventory item deleted.');
    }
}
