<?php

declare(strict_types=1);

namespace App\Models;

use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * An SMTP mailbox the email-blast system can send from. NULL user_id = shared
 * account usable by everyone; otherwise it's personal to that user (admins see
 * all). The password is encrypted at rest and never sent to the frontend.
 */
class EmailAccount extends Model
{
    protected $fillable = [
        'name', 'email', 'from_name',
        'smtp_host', 'smtp_port', 'encryption',
        'password', 'user_id',
    ];

    protected function casts(): array
    {
        return [
            'password' => 'encrypted',
            'smtp_port' => 'integer',
        ];
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    /** Accounts this user may send from: shared ones plus their own. */
    public function scopeVisibleTo(Builder $query, User $user): Builder
    {
        return $query->where(fn ($q) => $q->whereNull('user_id')->orWhere('user_id', $user->id));
    }

    /** Runtime mailer config for Mail::build(). */
    public function mailerConfig(): array
    {
        return [
            'transport' => 'smtp',
            'host' => $this->smtp_host,
            'port' => $this->smtp_port,
            'encryption' => $this->encryption,
            'username' => $this->email,
            'password' => (string) $this->password,
            'timeout' => 30,
        ];
    }
}
