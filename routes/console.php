<?php

use App\Console\Commands\BackupDatabase;
use App\Jobs\MarkExpiredOfferingsJob;
use App\Jobs\MarkOverdueInstallmentsJob;
use App\Jobs\PurgeOldTrashedOrdersJob;
use App\Jobs\RunAiScoringJob;
use Illuminate\Support\Facades\Schedule;

Schedule::job(new RunAiScoringJob)->dailyAt('00:00');
Schedule::job(new MarkOverdueInstallmentsJob)->dailyAt('09:00');
Schedule::job(new MarkExpiredOfferingsJob)->dailyAt('09:05');
Schedule::job(new PurgeOldTrashedOrdersJob)->dailyAt('02:00');

// Daily DB backup at 03:00; keep 7 most recent dumps
Schedule::command(BackupDatabase::class, ['--keep=7'])->dailyAt('03:00')->runInBackground();

// Process the database queue each minute (no long-running daemon on shared
// hosting). --max-time keeps each invocation inside the minute; the WA blast
// engine re-dispatches itself with delays, so pacing lives in the queue.
Schedule::command('queue:work --stop-when-empty --tries=1 --max-time=55')
    ->everyMinute()
    ->withoutOverlapping();

// WA blast engine: promote due scheduled blasts; recover workers killed mid-send.
Schedule::command('blasts:dispatch-scheduled')->everyMinute()->withoutOverlapping();
Schedule::command('blasts:recover-stuck')->everyFifteenMinutes()->withoutOverlapping();
Schedule::command('blast-files:purge-expired')->hourly()->withoutOverlapping();
Schedule::command('blasts:cleanup --days=60')->monthlyOn(1, '03:00')->withoutOverlapping();
