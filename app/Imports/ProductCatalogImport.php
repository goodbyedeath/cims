<?php

declare(strict_types=1);

namespace App\Imports;

use App\Models\ProductCatalog;
use Maatwebsite\Excel\Concerns\SkipsEmptyRows;
use Maatwebsite\Excel\Concerns\ToModel;
use Maatwebsite\Excel\Concerns\WithBatchInserts;
use Maatwebsite\Excel\Concerns\WithChunkReading;
use Maatwebsite\Excel\Concerns\WithHeadingRow;

class ProductCatalogImport implements ToModel, WithHeadingRow, SkipsEmptyRows, WithBatchInserts, WithChunkReading
{
    private int $created = 0;
    private int $updated = 0;
    private int $skipped = 0;

    public function batchSize(): int { return 500; }
    public function chunkSize(): int { return 500; }

    public function model(array $row): ?ProductCatalog
    {
        $uid         = trim((string) ($row['uid'] ?? ''));
        $id          = (int) ($row['id'] ?? 0);
        $productName = trim((string) ($row['product_name'] ?? ''));

        // Nothing to identify or create from
        if ($uid === '' && $id === 0 && $productName === '') {
            $this->skipped++;
            return null;
        }

        // Try to find an existing record by uid first, then id
        $existing = null;
        if ($uid !== '') {
            $existing = ProductCatalog::where('uid', $uid)->first();
        }
        if (!$existing && $id > 0) {
            $existing = ProductCatalog::find($id);
        }

        if ($existing) {
            // Build a partial update — only include columns present in the file
            $patch = $this->buildPatch($row, $productName);
            if (!empty($patch)) {
                $existing->update($patch);
            }
            $this->updated++;
            return null;
        }

        // No matching record → create new (product_name required)
        if ($productName === '') {
            $this->skipped++;
            return null;
        }

        $this->created++;
        return new ProductCatalog($this->buildFull($row, $productName));
    }

    private function buildPatch(array $row, string $productName): array
    {
        $patch = [];

        if ($productName !== '') {
            $patch['product_name'] = $productName;
        }
        if (($v = trim((string) ($row['brand'] ?? ''))) !== '') {
            $patch['brand'] = $v;
        }
        if (($v = trim((string) ($row['category'] ?? ''))) !== '') {
            $patch['category'] = $v;
        }
        // description: allow explicit empty to clear it; only touch if column exists in file
        if (array_key_exists('description', $row)) {
            $patch['description'] = trim((string) $row['description']) ?: null;
        }
        if (isset($row['best_price']) && $row['best_price'] !== '') {
            $patch['best_price'] = max(0, (int) $row['best_price']);
        }
        if (isset($row['moq']) && $row['moq'] !== '') {
            $patch['moq'] = max(1, (int) $row['moq']);
        }
        if (isset($row['status']) && in_array($row['status'], ['active', 'inactive'], true)) {
            $patch['status'] = $row['status'];
        }
        if (isset($row['stock_status']) && in_array($row['stock_status'], ['ready', 'indent'], true)) {
            $patch['stock_status'] = $row['stock_status'];
        }
        if (isset($row['sort_order']) && $row['sort_order'] !== '') {
            $patch['sort_order'] = (int) $row['sort_order'];
        }

        return $patch;
    }

    private function buildFull(array $row, string $productName): array
    {
        $status      = in_array($row['status'] ?? '', ['active', 'inactive'], true) ? $row['status'] : 'active';
        $stockStatus = in_array($row['stock_status'] ?? '', ['ready', 'indent'], true) ? $row['stock_status'] : 'ready';

        return [
            'brand'        => trim((string) ($row['brand'] ?? '')),
            'category'     => trim((string) ($row['category'] ?? '')),
            'product_name' => $productName,
            'description'  => trim((string) ($row['description'] ?? '')) ?: null,
            'best_price'   => max(0, (int) ($row['best_price'] ?? 0)),
            'moq'          => max(1, (int) ($row['moq'] ?? 1)),
            'status'       => $status,
            'stock_status' => $stockStatus,
            'sort_order'   => (int) ($row['sort_order'] ?? 0),
        ];
    }

    public function getCreatedCount(): int { return $this->created; }
    public function getUpdatedCount(): int { return $this->updated; }
    public function getSkippedCount(): int { return $this->skipped; }
}
