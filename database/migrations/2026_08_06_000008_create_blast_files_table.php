<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * An uploaded blast attachment, stored privately and served via per-recipient
 * tracked links (never a WA media send). Auto-purged after expires_at.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('blast_files', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->nullable()->constrained('users')->nullOnDelete();
            $table->string('original_name');
            $table->string('stored_path');
            $table->string('mime')->nullable();
            $table->unsignedBigInteger('size')->default(0);
            $table->timestamp('expires_at')->nullable()->index();
            $table->timestamp('file_purged_at')->nullable();
            $table->unsignedInteger('download_count')->default(0);
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('blast_files');
    }
};
