<?php

declare(strict_types=1);

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class WaBlastRecipient extends Model
{
    protected $fillable = [
        'wa_blast_id',
        'channel_id',
        'phone',
        'status',
        'error',
        'sent_at',
    ];

    protected function casts(): array
    {
        return [
            'sent_at' => 'datetime',
        ];
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
