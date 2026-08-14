<?php

declare(strict_types=1);

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Str;

class WaBotRule extends Model
{
    protected $fillable = [
        'user_id',
        'name',
        'match_type',
        'keyword',
        'reply_type',
        'reply_message',
        'wa_form_id',
        'priority',
        'is_active',
        'hit_count',
        'last_hit_at',
    ];

    protected function casts(): array
    {
        return [
            'is_active'   => 'boolean',
            'priority'    => 'integer',
            'hit_count'   => 'integer',
            'last_hit_at' => 'datetime',
        ];
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function form(): BelongsTo
    {
        return $this->belongsTo(WaForm::class, 'wa_form_id');
    }

    /**
     * @return array<int,string> normalised, lower-cased keyword list
     */
    public function keywordList(): array
    {
        return collect(explode(',', (string) $this->keyword))
            ->map(fn ($k) => Str::lower(trim($k)))
            ->filter()
            ->values()
            ->all();
    }

    /**
     * Does an inbound message body match this rule?
     */
    public function matches(string $incoming): bool
    {
        if ($this->match_type === 'default') {
            return true;
        }

        $text = Str::lower(trim($incoming));
        if ($text === '') {
            return false;
        }

        foreach ($this->keywordList() as $kw) {
            $hit = match ($this->match_type) {
                'exact'       => $text === $kw,
                'starts_with' => Str::startsWith($text, $kw),
                'contains'    => Str::contains($text, $kw),
                default       => false,
            };

            if ($hit) {
                return true;
            }
        }

        return false;
    }
}
