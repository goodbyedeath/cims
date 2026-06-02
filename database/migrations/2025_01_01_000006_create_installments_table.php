<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('installments', function (Blueprint $table) {
            $table->id();
            $table->foreignId('payment_id')->constrained()->cascadeOnDelete();
            $table->unsignedTinyInteger('installment_no');
            $table->date('due_date');
            $table->decimal('amount', 15, 2);
            $table->decimal('percentage', 5, 2)->default(0);
            $table->enum('status', ['unpaid', 'paid', 'late'])->default('unpaid');
            $table->date('paid_date')->nullable();
            $table->text('note')->nullable();
            $table->timestamps();

            $table->index(['status', 'due_date']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('installments');
    }
};
