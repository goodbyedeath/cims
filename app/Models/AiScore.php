<?php

declare(strict_types=1);

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class AiScore extends Model
{
    public $timestamps = false;

    protected $fillable = [
        'channel_id',
        'repeat_probability',
        'risk_churn_score',
        'payment_risk_score',
        'growth_score',
        'recommended_action',
        'generated_at',
    ];

    protected function casts(): array
    {
        return [
            'repeat_probability' => 'decimal:2',
            'risk_churn_score' => 'decimal:2',
            'payment_risk_score' => 'decimal:2',
            'growth_score' => 'decimal:2',
            'generated_at' => 'datetime',
        ];
    }

    public function channel(): BelongsTo
    {
        return $this->belongsTo(Channel::class);
    }
}
