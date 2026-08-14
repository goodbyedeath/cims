<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        // "processing" = row claimed by a batch driver. Lets concurrent drivers
        // (compose-modal loop + Show-page resume) coexist without double-sending.
        // Appending an enum value is an INSTANT ALTER — safe on a live table.
        DB::statement("ALTER TABLE email_blast_recipients
            MODIFY status ENUM('pending','processing','sent','failed') NOT NULL DEFAULT 'pending'");
    }

    public function down(): void
    {
        DB::statement("UPDATE email_blast_recipients SET status = 'pending' WHERE status = 'processing'");
        DB::statement("ALTER TABLE email_blast_recipients
            MODIFY status ENUM('pending','sent','failed') NOT NULL DEFAULT 'pending'");
    }
};
