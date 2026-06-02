<?php

declare(strict_types=1);

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasOne;
use Illuminate\Database\Eloquent\SoftDeletes;

class Channel extends Model
{
    use HasFactory, SoftDeletes;

    protected $fillable = [
        'channel_code',
        'company_name',
        'owner_name',
        'gender',
        'purchasing_staff',
        'phone',
        'email',
        'email_invalid',
        'email_unsubscribed',
        'email_unsubscribed_at',
        'address',
        'province',
        'city',
        'district',
        'latitude',
        'longitude',
        'assigned_user_id',
        'status',
        'blacklist_reason',
        'successful_order',
        'cancelation_order',
        'pending_order',
        'performance_score',
        'channel_grade',
        'last_update',
        'last_update_at',
    ];

    public function getOwnerTitleAttribute(): string
    {
        $prefix = $this->gender === 'female' ? 'Bu' : 'Pak';
        return "{$prefix} {$this->owner_name}";
    }

    protected function casts(): array
    {
        return [
            'latitude'      => 'decimal:7',
            'longitude'     => 'decimal:7',
            'performance_score' => 'decimal:2',
            'last_update_at' => 'datetime',
            'email_invalid'         => 'boolean',
            'email_unsubscribed'    => 'boolean',
            'email_unsubscribed_at' => 'datetime',
        ];
    }

    public function assignedUser(): BelongsTo
    {
        return $this->belongsTo(User::class, 'assigned_user_id');
    }

    public function orders(): HasMany
    {
        return $this->hasMany(Order::class);
    }

    public function logs(): HasMany
    {
        return $this->hasMany(ChannelLog::class)->latest('created_at');
    }

    public function aiScore(): HasOne
    {
        return $this->hasOne(AiScore::class);
    }
}
