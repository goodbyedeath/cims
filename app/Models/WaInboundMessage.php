<?php

declare(strict_types=1);

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class WaInboundMessage extends Model
{
    protected $fillable = [
        'phone',
        'channel_id',
        'message',
        'matched_rule_id',
        'reply_sent',
        'reply_text',
        'reply_error',
        'raw',
    ];

    protected function casts(): array
    {
        return [
            'reply_sent' => 'boolean',
            'raw'        => 'array',
        ];
    }

    public function channel(): BelongsTo
    {
        return $this->belongsTo(Channel::class);
    }

    public function rule(): BelongsTo
    {
        return $this->belongsTo(WaBotRule::class, 'matched_rule_id');
    }
}
