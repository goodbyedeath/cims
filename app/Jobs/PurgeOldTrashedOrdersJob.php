<?php

declare(strict_types=1);

namespace App\Jobs;

use App\Models\Order;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Queue\Queueable;

class PurgeOldTrashedOrdersJob implements ShouldQueue
{
    use Queueable;

    public function handle(): void
    {
        Order::onlyTrashed()
            ->where('deleted_at', '<', now()->subDays(7))
            ->with(['items', 'payment.installments'])
            ->get()
            ->each(function (Order $order): void {
                $order->items()->delete();

                if ($order->payment) {
                    $order->payment->installments()->delete();
                    $order->payment->delete();
                }

                $order->forceDelete();
            });
    }
}
