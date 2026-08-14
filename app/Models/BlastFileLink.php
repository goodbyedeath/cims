<?php

declare(strict_types=1);

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class BlastFileLink extends Model
{
    protected $fillable = [
        'blast_file_id',
        'wa_blast_id',
        'channel_id',
        'phone',
        'token',
        'downloaded_at',
        'download_count',
    ];

    protected function casts(): array
    {
        return [
            'downloaded_at' => 'datetime',
        ];
    }

    public function file(): BelongsTo
    {
        return $this->belongsTo(BlastFile::class, 'blast_file_id');
    }

    public function blast(): BelongsTo
    {
        return $this->belongsTo(WaBlast::class, 'wa_blast_id');
    }

    public function channel(): BelongsTo
    {
        return $this->belongsTo(Channel::class);
    }
}
