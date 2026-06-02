<?php

declare(strict_types=1);

namespace App\Jobs;

use App\Services\AiScoringService;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Queue\Queueable;

class RunAiScoringJob implements ShouldQueue
{
    use Queueable;

    public function handle(AiScoringService $service): void
    {
        $service->scoreAllChannels();
    }
}
