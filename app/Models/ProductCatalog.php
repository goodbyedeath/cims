<?php

declare(strict_types=1);

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;

class ProductCatalog extends Model
{
    use HasFactory;

    protected $fillable = [
        'uid',
        'brand',
        'category',
        'product_name',
        'description',
        'selling_points',
        'application_scenario',
        'best_price',
        'special_discount_pct',
        'moq',
        'image_path',
        'status',
        'stock_status',
        'sort_order',
        'is_featured',
    ];

    protected static function booted(): void
    {
        static::creating(function (self $catalog) {
            if (empty($catalog->uid)) {
                $catalog->uid = (string) Str::ulid();
            }
        });
    }

    protected function casts(): array
    {
        return [
            'best_price'    => 'integer',
            'moq'           => 'integer',
            'sort_order'    => 'integer',
            'selling_points' => 'array',
            'is_featured'   => 'boolean',
        ];
    }

    /**
     * Resolve the public URL for the product image, or null if none stored.
     */
    public function getImageUrlAttribute(): ?string
    {
        return $this->image_path ? Storage::url($this->image_path) : null;
    }

    protected $appends = ['image_url'];
}
