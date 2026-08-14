<?php

declare(strict_types=1);

namespace App\Console\Commands;

use App\Jobs\SendWaBlastJob;
use App\Models\WaBlast;
use Illuminate\Console\Command;

/**
 * Promote due 'scheduled' blasts (initially-scheduled sends, and blasts parked
 * during a disconnect) back into the queue. Runs every minute.
 */
class DispatchScheduledBlasts extends Command
{
    protected $signature = 'blasts:dispatch-scheduled';

    protected $description = 'Queue WA blasts whose scheduled_at is due';

    public function handle(): int
    {
        // Quiet hours: never promote scheduled blasts in the dead of night.
        $hour = now('Asia/Jakarta')->hour;
        if ($hour < 8 || $hour >= 21) {
            return self::SUCCESS;
        }

        $due = WaBlast::where('status', 'scheduled')
            ->where('scheduled_at', '<=', now())
            ->get();

        foreach ($due as $blast) {
            $blast->update(['status' => 'queued']);
            SendWaBlastJob::dispatch($blast->id);
            $this->info("Queued blast #{$blast->id}");
        }

        return self::SUCCESS;
    }
}
