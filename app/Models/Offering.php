<?php

declare(strict_types=1);

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;

class Offering extends Model
{
    use HasFactory, SoftDeletes;

    protected $fillable = [
        'offering_no',
        'ref_no',
        'channel_id',
        'sales_id',
        'offering_date',
        'valid_until',
        'status',
        'subtotal',
        'discount',
        'tax',
        'grand_total',
        'note',
    ];

    protected function casts(): array
    {
        return [
            'offering_date' => 'date',
            'valid_until'   => 'date',
            'subtotal'      => 'decimal:2',
            'discount'      => 'decimal:2',
            'tax'           => 'decimal:2',
            'grand_total'   => 'decimal:2',
        ];
    }

    public function channel(): BelongsTo
    {
        return $this->belongsTo(Channel::class);
    }

    public function sales(): BelongsTo
    {
        return $this->belongsTo(User::class, 'sales_id');
    }

    public function items(): HasMany
    {
        return $this->hasMany(OfferingItem::class);
    }
}
