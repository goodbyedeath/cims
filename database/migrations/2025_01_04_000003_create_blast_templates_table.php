<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('blast_templates', function (Blueprint $table) {
            $table->id();
            $table->string('name');
            $table->enum('type', ['wa', 'email']);
            $table->string('subject')->nullable(); // email only
            $table->longText('body');
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->timestamps();

            $table->index('type');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('blast_templates');
    }
};
