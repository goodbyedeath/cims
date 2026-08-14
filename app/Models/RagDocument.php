<?php

declare(strict_types=1);

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class RagDocument extends Model
{
    protected $fillable = [
        'user_id',
        'document_id',
        'title',
        'source',
        'filename',
        'bytes',
        'chunks_indexed',
    ];

    protected function casts(): array
    {
        return [
            'bytes'          => 'integer',
            'chunks_indexed' => 'integer',
        ];
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}
