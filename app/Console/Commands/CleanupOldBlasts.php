<?php

declare(strict_types=1);

namespace App\Console\Commands;

use App\Models\WaBlast;
use Illuminate\Console\Command;

/**
 * Prune finished WA blasts (and their recipients/file links via cascade) older
 * than --days, to keep the tables lean. Runs monthly.
 */
class CleanupOldBlasts extends Command
{
    protected $signature = 'blasts:cleanup {--days=60}';

    protected $description = 'Delete finished WA blasts older than N days';

    public function handle(): int
    {
        $days   = (int) $this->option('days');
        $cutoff = now()->subDays($days);

        $blasts = WaBlast::whereIn('status', ['completed', 'failed', 'cancelled'])
            ->where('created_at', '<', $cutoff)
            ->get();

        foreach ($blasts as $blast) {
            $blast->fileLinks()->delete();
            $blast->recipients()->delete();
            $blast->delete();
        }

        $this->info("Deleted {$blasts->count()} blasts older than {$days} days.");

        return self::SUCCESS;
    }
}
