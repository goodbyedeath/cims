<?php

declare(strict_types=1);

namespace App\Console\Commands;

use App\Jobs\SendWaBlastJob;
use App\Models\WaBlast;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Cache;

/**
 * A live 'sending' blast writes on every send, so no update for > 25 min means
 * its queue worker was killed mid-invocation. Re-queue it — and force-release
 * the WithoutOverlapping lock the dead worker never freed, or the re-dispatch
 * is silently dropped as a duplicate.
 */
class RecoverStuckBlasts extends Command
{
    protected $signature = 'blasts:recover-stuck';

    protected $description = 'Re-queue WA blasts whose worker died mid-send';

    public function handle(): int
    {
        $threshold = now()->subMinutes(25);

        WaBlast::where('status', 'sending')
            ->where('updated_at', '<=', $threshold)
            ->each(function (WaBlast $blast) {
                Cache::lock('laravel-queue-overlap:wa-blast-'.$blast->id)->forceRelease();
                $blast->update(['status' => 'queued']);
                SendWaBlastJob::dispatch($blast->id);
                $this->info("Recovered blast #{$blast->id}");
            });

        return self::SUCCESS;
    }
}
