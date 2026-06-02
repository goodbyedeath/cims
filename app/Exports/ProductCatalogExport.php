<?php

declare(strict_types=1);

namespace App\Exports;

use App\Models\ProductCatalog;
use Maatwebsite\Excel\Concerns\FromCollection;
use Maatwebsite\Excel\Concerns\ShouldAutoSize;
use Maatwebsite\Excel\Concerns\WithHeadings;
use Maatwebsite\Excel\Concerns\WithMapping;
use Maatwebsite\Excel\Concerns\WithStyles;
use PhpOffice\PhpSpreadsheet\Worksheet\Worksheet;

class ProductCatalogExport implements FromCollection, WithHeadings, WithMapping, ShouldAutoSize, WithStyles
{
    public function collection()
    {
        return ProductCatalog::orderBy('sort_order')->orderBy('id')->get();
    }

    public function headings(): array
    {
        return ['uid', 'id', 'brand', 'category', 'product_name', 'description', 'best_price', 'moq', 'status', 'stock_status', 'sort_order'];
    }

    public function map($row): array
    {
        return [
            $row->uid,
            $row->id,
            $row->brand,
            $row->category,
            $row->product_name,
            $row->description ?? '',
            $row->best_price,
            $row->moq,
            $row->status,
            $row->stock_status,
            $row->sort_order,
        ];
    }

    public function styles(Worksheet $sheet): array
    {
        return [
            1 => ['font' => ['bold' => true]],
        ];
    }
}
