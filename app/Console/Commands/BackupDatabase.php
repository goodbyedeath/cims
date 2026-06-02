<?php

declare(strict_types=1);

namespace App\Console\Commands;

use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;

class BackupDatabase extends Command
{
    protected $signature   = 'db:backup {--keep=7 : Days of backups to retain}';
    protected $description = 'Dump the MySQL database to storage/app/backups/ using pure PHP/PDO';

    public function handle(): int
    {
        $dir = storage_path('app/backups');
        if (! is_dir($dir)) {
            mkdir($dir, 0750, true);
        }

        $file = $dir . '/backup-' . now()->format('Y-m-d_His') . '.sql.gz';

        $gz = gzopen($file, 'wb9');
        if ($gz === false) {
            $this->error("Cannot open {$file} for writing.");
            return self::FAILURE;
        }

        try {
            $db     = DB::connection();
            $dbName = config('database.connections.mysql.database');

            gzwrite($gz, "-- CIMS Database Backup\n");
            gzwrite($gz, "-- Generated: " . now()->toIso8601String() . "\n");
            gzwrite($gz, "-- Database: {$dbName}\n\n");
            gzwrite($gz, "SET FOREIGN_KEY_CHECKS=0;\n\n");

            $tables = $db->select('SHOW TABLES');
            $key    = "Tables_in_{$dbName}";

            foreach ($tables as $row) {
                $table = $row->$key;
                $this->dumpTable($gz, $db, $table);
            }

            gzwrite($gz, "\nSET FOREIGN_KEY_CHECKS=1;\n");
        } finally {
            gzclose($gz);
        }

        $sizeMb = round(filesize($file) / 1048576, 2);
        $this->info("Backup saved: {$file} ({$sizeMb} MB)");
        Log::info("DB backup completed: {$file} ({$sizeMb} MB)");

        $this->pruneOldBackups($dir, (int) $this->option('keep'));

        return self::SUCCESS;
    }

    /** @param resource $gz */
    private function dumpTable($gz, \Illuminate\Database\Connection $db, string $table): void
    {
        // CREATE TABLE
        $create = $db->select("SHOW CREATE TABLE `{$table}`");
        $ddl    = $create[0]->{'Create Table'} ?? null;

        gzwrite($gz, "-- Table: `{$table}`\n");
        gzwrite($gz, "DROP TABLE IF EXISTS `{$table}`;\n");
        if ($ddl) {
            gzwrite($gz, $ddl . ";\n\n");
        }

        // Rows in batches of 500
        $offset = 0;
        $batch  = 500;

        while (true) {
            $rows = $db->select("SELECT * FROM `{$table}` LIMIT {$batch} OFFSET {$offset}");
            if (empty($rows)) {
                break;
            }

            $cols = '`' . implode('`, `', array_keys((array) $rows[0])) . '`';
            $values = [];

            foreach ($rows as $row) {
                $escaped = array_map(function ($v) use ($db) {
                    if ($v === null) return 'NULL';
                    return "'" . addslashes((string) $v) . "'";
                }, (array) $row);
                $values[] = '(' . implode(', ', $escaped) . ')';
            }

            gzwrite($gz, "INSERT INTO `{$table}` ({$cols}) VALUES\n");
            gzwrite($gz, implode(",\n", $values) . ";\n");

            $offset += $batch;
            if (count($rows) < $batch) {
                break;
            }
        }

        gzwrite($gz, "\n");
    }

    private function pruneOldBackups(string $dir, int $keep): void
    {
        $files = glob($dir . '/backup-*.sql.gz') ?: [];
        rsort($files);
        foreach (array_slice($files, $keep) as $old) {
            unlink($old);
            $this->line("Pruned: " . basename($old));
        }
    }
}
