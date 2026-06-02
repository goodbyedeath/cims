<?php

declare(strict_types=1);

namespace App\Notifications;

use App\Models\Channel;
use Illuminate\Bus\Queueable;
use Illuminate\Notifications\Notification;

class NewChannelNotification extends Notification
{
    use Queueable;

    public function __construct(private Channel $channel) {}

    public function via(object $notifiable): array
    {
        return ['database'];
    }

    public function toArray(object $notifiable): array
    {
        return [
            'type' => 'new_channel',
            'icon' => 'building',
            'title' => 'New Channel',
            'message' => "{$this->channel->company_name} ({$this->channel->channel_code})",
            'url' => "/channels/{$this->channel->id}",
        ];
    }
}
