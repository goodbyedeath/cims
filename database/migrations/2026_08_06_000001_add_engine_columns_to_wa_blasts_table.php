<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Queue-driven blast engine state on wa_blasts: the device it sends through,
 * a persisted circuit-breaker counter, a disconnect-spell anchor, and the
 * scheduled/timer columns the one-message-per-job engine needs. Also widens
 * the status enum and makes `message` nullable (non-text blasts store NULL).
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('wa_blasts', function (Blueprint $table) {
            $table->foreignId('device_id')->nullable()->after('user_id')
                ->constrained('wa_devices')->nullOnDelete();
            $table->unsignedInteger('consecutive_fail')->default(0)->after('failed_count');
            $table->timestamp('disconnect_started_at')->nullable()->after('consecutive_fail');
            $table->timestamp('scheduled_at')->nullable()->after('disconnect_started_at');
            $table->timestamp('started_at')->nullable()->after('scheduled_at');
            $table->timestamp('finished_at')->nullable()->after('started_at');
        });

        DB::statement('ALTER TABLE wa_blasts MODIFY message TEXT NULL');
        DB::statement("ALTER TABLE wa_blasts MODIFY status ENUM('draft','queued','scheduled','sending','completed','failed','cancelling','cancelled') NOT NULL DEFAULT 'draft'");
    }

    public function down(): void
    {
        Schema::table('wa_blasts', function (Blueprint $table) {
            $table->dropConstrainedForeignId('device_id');
            $table->dropColumn(['consecutive_fail', 'disconnect_started_at', 'scheduled_at', 'started_at', 'finished_at']);
        });

        DB::statement('ALTER TABLE wa_blasts MODIFY message TEXT NOT NULL');
        DB::statement("ALTER TABLE wa_blasts MODIFY status ENUM('draft','sending','completed','failed') NOT NULL DEFAULT 'draft'");
    }
};
