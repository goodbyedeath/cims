<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        DB::statement("ALTER TABLE channels MODIFY channel_grade ENUM('platinum','gold','silver','risk') NOT NULL DEFAULT 'silver'");
    }

    public function down(): void
    {
        DB::statement("ALTER TABLE channels MODIFY channel_grade ENUM('platinum','gold','silver','risk') NOT NULL DEFAULT 'risk'");
    }
};
