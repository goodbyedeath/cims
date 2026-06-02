<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('payments', function (Blueprint $table) {
            $table->id();
            $table->foreignId('order_id')->constrained()->cascadeOnDelete();
            $table->enum('type_order', ['cash', 'installment'])->default('cash');
            $table->decimal('dp', 15, 2)->default(0);
            $table->decimal('remaining_debt', 15, 2)->default(0);
            $table->unsignedTinyInteger('installment_count')->default(0);
            $table->decimal('installment_percent', 5, 2)->default(0);
            $table->enum('payment_status', ['unpaid', 'partial', 'paid'])->default('unpaid');
            $table->text('note')->nullable();
            $table->timestamps();

            $table->index('payment_status');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('payments');
    }
};
