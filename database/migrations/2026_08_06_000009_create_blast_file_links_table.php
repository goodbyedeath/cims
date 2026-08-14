<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * One unguessable download link per (blast, file, recipient). Records the first
 * open (downloaded_at) + counts for open-tracking. Kept for history even after
 * the physical file is purged.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('blast_file_links', function (Blueprint $table) {
            $table->id();
            $table->foreignId('blast_file_id')->constrained('blast_files')->cascadeOnDelete();
            $table->foreignId('wa_blast_id')->nullable()->constrained('wa_blasts')->nullOnDelete();
            $table->foreignId('channel_id')->nullable()->constrained('channels')->nullOnDelete();
            $table->string('phone', 25);
            $table->string('token', 32)->unique();
            $table->timestamp('downloaded_at')->nullable();
            $table->unsignedInteger('download_count')->default(0);
            $table->timestamps();

            $table->unique(['wa_blast_id', 'blast_file_id', 'phone']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('blast_file_links');
    }
};
