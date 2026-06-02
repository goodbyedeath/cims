<?php

declare(strict_types=1);

namespace App\Console\Commands;

use Illuminate\Console\Command;
use Illuminate\Support\Facades\Log;

class BackupDatabase extends Command
{
    protected $signature   = 'db:backup {--keep=7 : Days of backups to retain}';
    protected $description = 'Dump the MySQL database to storage/app/backups/';

    public function handle(): int
    {
        $dir = storage_path('app/backups');
        if (! is_dir($dir)) {
            mkdir($dir, 0750, true);
        }

        $file = $dir . '/backup-' . now()->format('Y-m-d_His') . '.sql.gz';

        $host = config('database.connections.mysql.host');
        $port = config('database.connections.mysql.port', 3306);
        $db   = config('database.connections.mysql.database');
        $user = config('database.connections.mysql.username');
        $pass = config('database.connections.mysql.password');

        // Write a temporary .my.cnf so the password is not in the process list
        $cnfPath = sys_get_temp_dir() . '/.my_backup_' . getmypid() . '.cnf';
        file_put_contents($cnfPath, "[client]\npassword={$pass}\n");
        chmod($cnfPath, 0600);

        $cmd = sprintf(
            'mysqldump --defaults-extra-file=%s -h %s -P %s -u %s --single-transaction --quick --skip-lock-tables %s | gzip > %s 2>&1',
            escapeshellarg($cnfPath),
            escapeshellarg((string) $host),
            escapeshellarg((string) $port),
            escapeshellarg((string) $user),
            escapeshellarg((string) $db),
            escapeshellarg($file)
        );

        exec($cmd, $output, $exitCode);
        unlink($cnfPath);

        if ($exitCode !== 0 || ! file_exists($file) || filesize($file) < 100) {
            Log::channel('security')->error('DB backup failed', ['exit' => $exitCode, 'output' => $output]);
            $this->error('Backup failed. Check logs.');
            return self::FAILURE;
        }

        $sizeMb = round(filesize($file) / 1048576, 2);
        $this->info("Backup saved: {$file} ({$sizeMb} MB)");
        Log::info("DB backup completed: {$file} ({$sizeMb} MB)");

        // Prune old backups
        $keep = max(1, (int) $this->option('keep'));
        $files = glob($dir . '/backup-*.sql.gz') ?: [];
        rsort($files);
        foreach (array_slice($files, $keep) as $old) {
            unlink($old);
            $this->line("Pruned: {$old}");
        }

        return self::SUCCESS;
    }
}
