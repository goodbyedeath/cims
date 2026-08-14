<?php

declare(strict_types=1);

namespace App\Imports;

use App\Models\CatalogSetting;
use App\Models\Inventory;
use Maatwebsite\Excel\Concerns\ToModel;
use Maatwebsite\Excel\Concerns\WithHeadingRow;
use Maatwebsite\Excel\Concerns\WithBatchInserts;
use Maatwebsite\Excel\Concerns\WithChunkReading;
use Maatwebsite\Excel\Concerns\SkipsEmptyRows;
use Maatwebsite\Excel\Concerns\WithEvents;
use Maatwebsite\Excel\Events\BeforeImport;
use Maatwebsite\Excel\Events\AfterImport;

class InventoryImport implements ToModel, WithHeadingRow, WithBatchInserts, WithChunkReading, SkipsEmptyRows, WithEvents
{
    private int    $imported        = 0;
    private int    $updated         = 0;
    private int    $skipped         = 0;
    private array  $existingSkus    = [];  // sku_no => true  (loaded once, replaces per-row SELECT)
    private array  $pendingUpdates  = [];  // rows to bulk-upsert after all chunks finish
    private string $formulaType     = 'subtract_percent';
    private float  $formulaValue    = 20.5;

    public function batchSize(): int { return 1000; }
    public function chunkSize(): int { return 1000; }

    public function registerEvents(): array
    {
        return [
            // One query before processing starts — loads every existing sku_no into memory
            // Also loads the SRP formula settings once so import rows can auto-calculate SRP.
            BeforeImport::class => function () {
                $this->existingSkus  = Inventory::pluck('sku_no')->flip()->all();
                $this->formulaType   = CatalogSetting::getValue('srp_formula_type', 'subtract_percent');
                $this->formulaValue  = (float) CatalogSetting::getValue('srp_formula_value', '20.5');
            },
            // After all chunks are processed — bulk-upsert every changed existing row
            AfterImport::class => function () {
                if (empty($this->pendingUpdates)) return;

                // Deduplicate by sku_no — last occurrence in the sheet wins
                $deduped = [];
                foreach ($this->pendingUpdates as $row) {
                    $deduped[$row['sku_no']] = $row;
                }

                $now = now()->toDateTimeString();
                foreach (array_chunk(array_values($deduped), 1000) as $chunk) {
                    foreach ($chunk as &$row) { $row['updated_at'] = $now; }
                    Inventory::upsert(
                        $chunk,
                        ['sku_no'],
                        ['product', 'kode_barang', 'spesifikasi', 'notes', 'qty', 'srp', 'm1', 'updated_at']
                    );
                    $this->updated += count($chunk);
                }
            },
        ];
    }

    public function model(array $row): ?Inventory
    {
        $skuNo = $this->cleanValue(
            $row['sku_no']     ??
            $row['sku_no_']    ??   // trailing underscore from "SKU No."
            $row['sku']        ??
            $row['no_sku']     ??
            $row['kode_sku']   ??
            $row['sku_number'] ??
            $row['item_code']  ??
            $row['code']       ??
            ''
        );

        if (empty($skuNo)) {
            $this->skipped++;
            return null;
        }

        $m1  = !empty($row['harga'])
                   ? (float) $this->cleanValue($row['harga'])
                   : $this->parsePrice($row['m1'] ?? $row['m1_harga'] ?? $row['m1 harga'] ?? 0);
        $srp = $this->parsePrice($row['srp'] ?? 0);

        // Auto-calculate SRP when it is zero/missing in the sheet and M1 is present.
        if ($srp <= 0.0 && $m1 > 0.0) {
            $srp = $this->applySrpFormula($m1);
        }

        $data = [
            'product'     => $this->cleanValue($row['product'] ?? ''),
            'kode_barang' => $this->cleanValue($row['kode_barang'] ?? $row['kodebarang'] ?? $row['kode barang'] ?? ''),
            'spesifikasi' => $this->cleanValue($row['spesifikasi'] ?? ''),
            'notes'       => $this->cleanValue($row['notes'] ?? ''),
            'qty'         => $this->sumQty($row),
            'srp'         => $srp,
            'm1'          => $m1,
        ];

        if (isset($this->existingSkus[$skuNo])) {
            // Existing record — stage for bulk upsert, no per-row SELECT
            $this->pendingUpdates[] = array_merge(['sku_no' => $skuNo], $data);
            return null;
        }

        // New record — returned to Laravel Excel for batch INSERT.
        // Mark as seen so any duplicate row in the same sheet hits the update path.
        $this->existingSkus[$skuNo] = true;
        $this->imported++;
        return new Inventory(array_merge(['sku_no' => $skuNo], $data));
    }

    public function getImportedCount(): int  { return $this->imported; }
    public function getUpdatedCount(): int   { return $this->updated;  }
    public function getUnchangedCount(): int { return 0; }
    public function getSkippedCount(): int   { return $this->skipped;  }

    private function applySrpFormula(float $m1): float
    {
        $v = $this->formulaValue;

        return match ($this->formulaType) {
            'subtract_percent' => $m1 * (1 - $v / 100),
            'add_percent'      => $m1 * (1 + $v / 100),
            'multiply'         => $m1 * $v,
            'divide'           => $v !== 0.0 ? $m1 / $v : $m1,
            'subtract_fixed'   => max(0.0, $m1 - $v),
            default            => $m1 * (1 - $v / 100),
        };
    }

    private function cleanValue(mixed $value): string
    {
        $val = trim((string) $value);

        // Strip Google Sheets IFERROR formula artifacts:
        // =IFERROR(__xludf.DUMMYFUNCTION("..."),"actual_value") or numeric fallback
        if (str_starts_with($val, '=') && preg_match('/,\s*("([^"]*?)"|([0-9.]+))\)$/', $val, $matches)) {
            return trim($matches[2] !== '' ? $matches[2] : ($matches[3] ?? ''));
        }

        return $val;
    }

    private function parsePrice(mixed $value): float
    {
        // Prices in the sheet are shorthand (e.g. 150 = Rp 150.000)
        return (float) $this->cleanValue($value) * 1000;
    }

    /**
     * qty is either a single "qty" column (legacy sheets) or stock split
     * across several per-location columns headed qty_1 … qty_n — sum
     * whatever is present. All columns blank/"infinite" still yields NULL,
     * which the app treats as untracked/unlimited stock.
     */
    private function sumQty(array $row): ?int
    {
        $sum = null;

        foreach ($row as $key => $value) {
            $k = (string) $key;
            if ($k !== 'qty' && !preg_match('/^qty_\w+$/', $k)) {
                continue;
            }

            $v = $this->parseNullableInt($value);
            if ($v !== null) {
                $sum = ($sum ?? 0) + $v;
            }
        }

        return $sum;
    }

    private function parseNullableInt(mixed $value): ?int
    {
        $cleaned = $this->cleanValue($value ?? '');

        if ($cleaned === '' || strtolower($cleaned) === 'infinite') {
            return null;
        }

        return (int) $cleaned;
    }
}
