<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('ai_scores', function (Blueprint $table) {
            $table->id();
            $table->foreignId('channel_id')->constrained()->cascadeOnDelete();
            $table->decimal('repeat_probability', 5, 2)->default(0);
            $table->decimal('risk_churn_score', 5, 2)->default(0);
            $table->decimal('payment_risk_score', 5, 2)->default(0);
            $table->decimal('growth_score', 5, 2)->default(0);
            $table->text('recommended_action')->nullable();
            $table->timestamp('generated_at')->useCurrent();

            $table->unique('channel_id');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('ai_scores');
    }
};
