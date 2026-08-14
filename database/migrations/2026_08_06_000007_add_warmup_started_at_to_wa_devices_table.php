<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Per-number warm-up anchor: set on a device's first-ever drip send. The daily
 * drip budget ramps from small to full over blast_drip_warmup_days from here.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('wa_devices', function (Blueprint $table) {
            $table->timestamp('warmup_started_at')->nullable()->after('last_used_at');
        });
    }

    public function down(): void
    {
        Schema::table('wa_devices', function (Blueprint $table) {
            $table->dropColumn('warmup_started_at');
        });
    }
};
