<?php

declare(strict_types=1);

namespace App\Console\Commands;

use App\Models\BlastFile;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Storage;

/**
 * Delete the physical bytes of any blast file past its expiry (keeping the row
 * + its link rows for history/tracking). Runs hourly.
 */
class PurgeExpiredBlastFiles extends Command
{
    protected $signature = 'blast-files:purge-expired';

    protected $description = 'Delete expired blast attachment files from disk';

    public function handle(): int
    {
        BlastFile::whereNull('file_purged_at')
            ->whereNotNull('expires_at')
            ->where('expires_at', '<', now())
            ->each(function (BlastFile $file) {
                if (Storage::disk('local')->exists($file->stored_path)) {
                    Storage::disk('local')->delete($file->stored_path);
                }
                $file->update(['file_purged_at' => now()]);
                $this->info("Purged blast file #{$file->id}");
            });

        return self::SUCCESS;
    }
}
