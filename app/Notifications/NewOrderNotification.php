<?php

declare(strict_types=1);

namespace App\Notifications;

use App\Models\Order;
use Illuminate\Bus\Queueable;
use Illuminate\Notifications\Notification;

class NewOrderNotification extends Notification
{
    use Queueable;

    public function __construct(private Order $order) {}

    public function via(object $notifiable): array
    {
        return ['database'];
    }

    public function toArray(object $notifiable): array
    {
        return [
            'type' => 'new_order',
            'icon' => 'shopping-cart',
            'title' => 'New Order',
            'message' => "Order {$this->order->order_no} from {$this->order->channel->company_name}",
            'url' => "/orders/{$this->order->id}",
        ];
    }
}
