<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Cooldown support: stamp the last time a channel was blasted so recently
 * messaged channels can be excluded (Channel::scopeBlastable). Indexed for the
 * blastable() filter. Channels are not Google-Sheet-synced, so nothing wipes it.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('channels', function (Blueprint $table) {
            $table->timestamp('last_blasted_at')->nullable()->index();
        });
    }

    public function down(): void
    {
        Schema::table('channels', function (Blueprint $table) {
            $table->dropColumn('last_blasted_at');
        });
    }
};
