<?php

declare(strict_types=1);

namespace App\Console\Commands;

use App\Models\Installment;
use App\Models\User;
use App\Notifications\OverdueInstallmentNotification;
use Illuminate\Console\Command;

class CheckOverdueInstallments extends Command
{
    protected $signature = 'notifications:check-overdue';
    protected $description = 'Check for overdue installments and notify users';

    public function handle(): int
    {
        $overdueInstallments = Installment::where('status', 'unpaid')
            ->where('due_date', '<', now()->startOfDay())
            ->with('payment.order.channel')
            ->get();

        if ($overdueInstallments->isEmpty()) {
            $this->info('No overdue installments found.');
            return 0;
        }

        $users = User::all();

        foreach ($overdueInstallments as $installment) {
            $installment->update(['status' => 'late']);

            foreach ($users as $user) {
                // Avoid duplicate notifications for the same installment
                $exists = $user->notifications()
                    ->where('type', OverdueInstallmentNotification::class)
                    ->whereJsonContains('data->installment_id', $installment->id)
                    ->exists();

                if (!$exists) {
                    $user->notify(new OverdueInstallmentNotification($installment));
                }
            }
        }

        $this->info("Notified about {$overdueInstallments->count()} overdue installments.");

        return 0;
    }
}
