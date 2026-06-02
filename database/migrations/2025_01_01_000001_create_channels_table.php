<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('channels', function (Blueprint $table) {
            $table->id();
            $table->string('channel_code', 20)->unique();
            $table->string('company_name');
            $table->string('owner_name');
            $table->string('purchasing_staff')->nullable();
            $table->string('phone', 20);
            $table->string('email')->nullable();
            $table->text('address');
            $table->string('province');
            $table->string('city');
            $table->string('district')->nullable();
            $table->decimal('latitude', 10, 7)->nullable();
            $table->decimal('longitude', 10, 7)->nullable();
            $table->foreignId('assigned_user_id')->nullable()->constrained('users')->nullOnDelete();
            $table->enum('status', ['active', 'inactive', 'blacklist'])->default('active');
            $table->unsignedInteger('successful_order')->default(0);
            $table->unsignedInteger('cancelation_order')->default(0);
            $table->unsignedInteger('pending_order')->default(0);
            $table->decimal('performance_score', 5, 2)->default(0);
            $table->enum('channel_grade', ['platinum', 'gold', 'silver', 'risk'])->default('risk');
            $table->string('last_update')->nullable();
            $table->timestamp('last_update_at')->nullable();
            $table->timestamps();
            $table->softDeletes();

            $table->index(['status', 'channel_grade']);
            $table->index(['province', 'city']);
            $table->index('assigned_user_id');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('channels');
    }
};
