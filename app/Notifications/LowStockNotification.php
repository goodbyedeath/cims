<?php

declare(strict_types=1);

namespace App\Notifications;

use App\Models\Inventory;
use Illuminate\Bus\Queueable;
use Illuminate\Notifications\Notification;

class LowStockNotification extends Notification
{
    use Queueable;

    public function __construct(private Inventory $inventory) {}

    public function via(object $notifiable): array
    {
        return ['database'];
    }

    public function toArray(object $notifiable): array
    {
        return [
            'type' => 'low_stock',
            'icon' => 'package',
            'title' => 'Low Stock',
            'message' => "{$this->inventory->product} ({$this->inventory->sku_no}) — only {$this->inventory->qty} left",
            'url' => '/inventory',
        ];
    }
}
