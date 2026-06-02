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
