<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Numbers that must never be blasted (unsubscribed, bounced, complained).
 * The send engine skips any recipient whose normalized phone is listed.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('wa_blacklists', function (Blueprint $table) {
            $table->id();
            $table->string('phone', 25)->unique();
            $table->string('reason')->nullable();
            $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('wa_blacklists');
    }
};
