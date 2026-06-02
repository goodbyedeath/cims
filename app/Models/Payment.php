<?php

declare(strict_types=1);

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Payment extends Model
{
    use HasFactory;

    protected $fillable = [
        'order_id',
        'type_order',
        'dp',
        'remaining_debt',
        'installment_count',
        'installment_percent',
        'payment_status',
        'note',
    ];

    protected function casts(): array
    {
        return [
            'dp' => 'decimal:2',
            'remaining_debt' => 'decimal:2',
            'installment_percent' => 'decimal:2',
        ];
    }

    public function order(): BelongsTo
    {
        return $this->belongsTo(Order::class);
    }

    public function installments(): HasMany
    {
        return $this->hasMany(Installment::class);
    }
}
