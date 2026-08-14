<?php

declare(strict_types=1);

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class WaBlast extends Model
{
    protected $fillable = [
        'user_id',
        'device_id',
        'blast_file_id',
        'title',
        'message',
        'message_type',
        'media_url',
        'location_lat',
        'location_lng',
        'total_recipients',
        'sent_count',
        'failed_count',
        'consecutive_fail',
        'disconnect_started_at',
        'scheduled_at',
        'started_at',
        'finished_at',
        'status',
        'filters',
        'drip_enabled',
        'daily_sent_count',
        'daily_sent_date',
        'daily_target',
        'send_day_index',
    ];

    protected function casts(): array
    {
        return [
            'filters' => 'array',
            'disconnect_started_at' => 'datetime',
            'scheduled_at' => 'datetime',
            'started_at' => 'datetime',
            'finished_at' => 'datetime',
            'drip_enabled' => 'boolean',
            'daily_sent_date' => 'date',
        ];
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    /** The WA device this blast sends through (bound at creation). */
    public function device(): BelongsTo
    {
        return $this->belongsTo(WaDevice::class);
    }

    /** Optional attachment; its {file} placeholder resolves to a tracked link. */
    public function blastFile(): BelongsTo
    {
        return $this->belongsTo(BlastFile::class);
    }

    public function fileLinks(): HasMany
    {
        return $this->hasMany(BlastFileLink::class);
    }

    public function recipients(): HasMany
    {
        return $this->hasMany(WaBlastRecipient::class);
    }
}
