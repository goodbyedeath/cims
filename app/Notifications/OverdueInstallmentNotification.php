<?php

declare(strict_types=1);

namespace App\Notifications;

use App\Models\Installment;
use Illuminate\Bus\Queueable;
use Illuminate\Notifications\Notification;

class OverdueInstallmentNotification extends Notification
{
    use Queueable;

    public function __construct(private Installment $installment) {}

    public function via(object $notifiable): array
    {
        return ['database'];
    }

    public function toArray(object $notifiable): array
    {
        $payment = $this->installment->payment;
        $channel = $payment->order->channel ?? null;

        return [
            'type' => 'overdue_installment',
            'icon' => 'alert-triangle',
            'title' => 'Overdue Installment',
            'message' => "Installment #{$this->installment->installment_no} from " . ($channel->company_name ?? 'Unknown') . " is overdue",
            'url' => "/payments/{$payment->id}",
            'installment_id' => $this->installment->id,
        ];
    }
}
