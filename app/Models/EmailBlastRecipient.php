<?php

declare(strict_types=1);

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class EmailBlastRecipient extends Model
{
    protected $fillable = [
        'email_blast_id', 'channel_id', 'email',
        'status', 'error', 'sent_at', 'opened_at',
    ];

    protected function casts(): array
    {
        return ['sent_at' => 'datetime', 'opened_at' => 'datetime'];
    }

    public function blast(): BelongsTo
    {
        return $this->belongsTo(EmailBlast::class, 'email_blast_id');
    }

    public function channel(): BelongsTo
    {
        return $this->belongsTo(Channel::class);
    }
}
