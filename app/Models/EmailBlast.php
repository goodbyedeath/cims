<?php

declare(strict_types=1);

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class EmailBlast extends Model
{
    protected $fillable = [
        'user_id', 'email_account_id', 'title', 'subject', 'sender_name', 'body',
        'total_recipients', 'sent_count', 'failed_count',
        'status', 'filters', 'attachments',
    ];

    protected function casts(): array
    {
        return ['filters' => 'array', 'attachments' => 'array'];
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function emailAccount(): BelongsTo
    {
        return $this->belongsTo(EmailAccount::class);
    }

    public function recipients(): HasMany
    {
        return $this->hasMany(EmailBlastRecipient::class);
    }
}
