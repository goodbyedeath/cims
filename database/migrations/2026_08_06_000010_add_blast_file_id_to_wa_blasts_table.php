<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/** Optional attachment for a blast — its {file} placeholder resolves to a link. */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('wa_blasts', function (Blueprint $table) {
            $table->foreignId('blast_file_id')->nullable()->after('device_id')
                ->constrained('blast_files')->nullOnDelete();
        });
    }

    public function down(): void
    {
        Schema::table('wa_blasts', function (Blueprint $table) {
            $table->dropConstrainedForeignId('blast_file_id');
        });
    }
};
