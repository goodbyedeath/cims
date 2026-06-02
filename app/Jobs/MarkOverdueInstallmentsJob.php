<?php

declare(strict_types=1);

namespace App\Jobs;

use App\Models\Installment;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Queue\Queueable;

class MarkOverdueInstallmentsJob implements ShouldQueue
{
    use Queueable;

    public function handle(): void
    {
        Installment::where('status', 'unpaid')
            ->where('due_date', '<', now()->startOfDay())
            ->update(['status' => 'late']);
    }
}
