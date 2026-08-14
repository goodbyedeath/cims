<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Track when a device last actually sent, for pacing/warm-up decisions and
 * so parallel blasts on different numbers can be reasoned about.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('wa_devices', function (Blueprint $table) {
            $table->timestamp('last_used_at')->nullable()->after('last_checked_at');
        });
    }

    public function down(): void
    {
        Schema::table('wa_devices', function (Blueprint $table) {
            $table->dropColumn('last_used_at');
        });
    }
};
