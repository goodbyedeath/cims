<?php

declare(strict_types=1);

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class EmailBlast extends Model
{
    protected $fillable = [
        'user_id', 'title', 'subject', 'body',
        'total_recipients', 'sent_count', 'failed_count',
        'status', 'filters',
    ];

    protected function casts(): array
    {
        return ['filters' => 'array'];
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function recipients(): HasMany
    {
        return $this->hasMany(EmailBlastRecipient::class);
    }
}
