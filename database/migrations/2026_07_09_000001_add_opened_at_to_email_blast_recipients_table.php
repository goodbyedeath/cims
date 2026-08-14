<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('email_blast_recipients', function (Blueprint $table) {
            // First time the tracking pixel was requested — proxies (Gmail image
            // cache) still fire it once, so this is a reliable "was opened" bit.
            $table->timestamp('opened_at')->nullable()->after('sent_at');
        });
    }

    public function down(): void
    {
        Schema::table('email_blast_recipients', function (Blueprint $table) {
            $table->dropColumn('opened_at');
        });
    }
};
