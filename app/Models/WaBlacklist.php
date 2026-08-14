<?php

declare(strict_types=1);

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * A phone number that must never receive a blast. The send engine skips any
 * recipient whose normalized phone matches (store phones normalized to 62…).
 */
class WaBlacklist extends Model
{
    protected $fillable = ['phone', 'reason', 'created_by'];

    public function creator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }
}
