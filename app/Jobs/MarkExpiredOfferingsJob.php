<?php

declare(strict_types=1);

namespace App\Jobs;

use App\Models\Offering;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Queue\Queueable;

class MarkExpiredOfferingsJob implements ShouldQueue
{
    use Queueable;

    /**
     * Mark sent/draft offerings whose valid_until date has passed as expired.
     * Accepted and rejected offerings are intentionally skipped — they are final states.
     */
    public function handle(): void
    {
        Offering::whereIn('status', ['draft', 'sent'])
            ->whereNotNull('valid_until')
            ->where('valid_until', '<', now()->startOfDay())
            ->update(['status' => 'expired']);
    }
}
