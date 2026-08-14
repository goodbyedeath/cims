<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('rag_documents', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->nullable()->constrained()->nullOnDelete();
            $table->string('document_id')->index();
            $table->string('title');
            $table->string('source');                  // 'text' | 'file'
            $table->string('filename')->nullable();
            $table->unsignedBigInteger('bytes')->nullable();
            $table->unsignedInteger('chunks_indexed')->default(0);
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('rag_documents');
    }
};
