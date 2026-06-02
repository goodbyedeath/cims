<?php

declare(strict_types=1);

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class ChannelRequestLog extends Model
{
    protected $fillable = [
        'channel_request_id',
        'user_id',
        'from_status',
        'to_status',
        'note',
    ];

    public function channelRequest(): BelongsTo
    {
        return $this->belongsTo(ChannelRequest::class);
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}
