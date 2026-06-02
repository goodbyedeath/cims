<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('pipelines', function (Blueprint $table) {
            $table->id();
            $table->string('title');
            $table->foreignId('channel_id')->nullable()->constrained()->nullOnDelete();
            $table->foreignId('sales_id')->nullable()->constrained('users')->nullOnDelete();
            $table->decimal('value', 15, 2)->nullable();
            $table->unsignedTinyInteger('probability')->default(50);
            $table->enum('stage', ['prospect', 'qualified', 'proposal', 'negotiation', 'won', 'lost'])->default('prospect');
            $table->date('expected_close_date')->nullable();
            $table->text('note')->nullable();
            $table->string('lost_reason')->nullable();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('pipelines');
    }
};
