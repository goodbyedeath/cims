<?php

declare(strict_types=1);

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class ChannelLog extends Model
{
    public $timestamps = false;

    protected $fillable = [
        'channel_id',
        'user_id',
        'activity',
        'next_followup_date',
        'created_at',
    ];

    protected function casts(): array
    {
        return [
            'next_followup_date' => 'date',
            'created_at' => 'datetime',
        ];
    }

    public function channel(): BelongsTo
    {
        return $this->belongsTo(Channel::class);
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}
