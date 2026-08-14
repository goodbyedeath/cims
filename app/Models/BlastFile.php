<?php

declare(strict_types=1);

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class BlastFile extends Model
{
    protected $fillable = [
        'user_id',
        'original_name',
        'stored_path',
        'mime',
        'size',
        'expires_at',
        'file_purged_at',
        'download_count',
    ];

    protected function casts(): array
    {
        return [
            'expires_at' => 'datetime',
            'file_purged_at' => 'datetime',
        ];
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function links(): HasMany
    {
        return $this->hasMany(BlastFileLink::class);
    }

    /** Downloadable = not expired and the physical file is still present. */
    public function isActive(): bool
    {
        return $this->file_purged_at === null
            && ($this->expires_at === null || $this->expires_at->isFuture());
    }

    public function isExpired(): bool
    {
        return $this->expires_at !== null && $this->expires_at->isPast();
    }

    /** Human-readable size, e.g. "2.4 MB". */
    public function humanSize(): string
    {
        $bytes = (int) $this->size;
        foreach (['B', 'KB', 'MB', 'GB'] as $unit) {
            if ($bytes < 1024 || $unit === 'GB') {
                return round($bytes, 1).' '.$unit;
            }
            $bytes /= 1024;
        }

        return $this->size.' B';
    }
}
