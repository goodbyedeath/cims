<?php

declare(strict_types=1);

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Inventory extends Model
{
    protected $fillable = [
        'sku_no',
        'product',
        'kode_barang',
        'spesifikasi',
        'notes',
        'qty',
        'srp',
        'm1',
    ];

    protected function casts(): array
    {
        return [
            'srp' => 'decimal:2',
            'm1' => 'decimal:2',
            'qty' => 'integer',
        ];
    }

    public function orderItems(): HasMany
    {
        return $this->hasMany(OrderItem::class);
    }
}
