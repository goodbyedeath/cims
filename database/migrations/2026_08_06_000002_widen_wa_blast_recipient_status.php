<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

/**
 * Recipients are all created 'pending' upfront and the job walks them; add
 * 'skipped' (blacklisted/cooldown) and 'cancelled' terminal states.
 */
return new class extends Migration
{
    public function up(): void
    {
        DB::statement("ALTER TABLE wa_blast_recipients MODIFY status ENUM('pending','sent','failed','skipped','cancelled') NOT NULL DEFAULT 'pending'");
    }

    public function down(): void
    {
        DB::statement("ALTER TABLE wa_blast_recipients MODIFY status ENUM('pending','sent','failed') NOT NULL DEFAULT 'pending'");
    }
};
