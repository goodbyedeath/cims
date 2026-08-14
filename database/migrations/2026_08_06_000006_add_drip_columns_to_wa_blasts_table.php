<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Staggered "drip" sending state: a per-day budget (daily_target) rolled once
 * per day, the running count for the day, and the day index (for warm-up ramp).
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('wa_blasts', function (Blueprint $table) {
            $table->boolean('drip_enabled')->default(false)->after('status');
            $table->unsignedInteger('daily_sent_count')->default(0)->after('drip_enabled');
            $table->date('daily_sent_date')->nullable()->after('daily_sent_count');
            $table->unsignedInteger('daily_target')->nullable()->after('daily_sent_date');
            $table->unsignedInteger('send_day_index')->default(0)->after('daily_target');
        });
    }

    public function down(): void
    {
        Schema::table('wa_blasts', function (Blueprint $table) {
            $table->dropColumn(['drip_enabled', 'daily_sent_count', 'daily_sent_date', 'daily_target', 'send_day_index']);
        });
    }
};
