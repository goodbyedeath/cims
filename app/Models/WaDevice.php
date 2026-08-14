<?php

declare(strict_types=1);

namespace App\Models;

use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;

class WaDevice extends Model
{
    /** Traffic purposes a device can be dedicated to. */
    public const PURPOSES = ['general', 'otp', 'blast'];

    protected $fillable = [
        'name',
        'purpose',
        'server_url',
        'token',
        'secret_key',
        'scan_path',
        'phone',
        'is_active',
        'last_status',
        'last_info',
        'last_checked_at',
        'last_used_at',
        'warmup_started_at',
    ];

    protected function casts(): array
    {
        return [
            // Token & secret are encrypted at rest with APP_KEY.
            'token' => 'encrypted',
            'secret_key' => 'encrypted',
            'is_active' => 'boolean',
            'last_info' => 'array',
            'last_checked_at' => 'datetime',
            'last_used_at' => 'datetime',
            'warmup_started_at' => 'datetime',
        ];
    }

    public function scopeActive(Builder $query): Builder
    {
        return $query->where('is_active', true);
    }

    public function serverUrl(): string
    {
        return rtrim($this->server_url ?: 'https://jkt.wablas.com', '/');
    }

    /**
     * Wablas device-management endpoints authenticate with "token.secret_key";
     * plain sending endpoints accept the token alone.
     */
    public function authHeader(): string
    {
        $secret = (string) ($this->secret_key ?? '');

        return $secret !== '' ? "{$this->token}.{$secret}" : (string) $this->token;
    }

    /** Last few characters of the token — safe to show in the UI. */
    public function tokenHint(): string
    {
        $token = (string) $this->token;

        return $token === '' ? '' : '…' . substr($token, -6);
    }
}
