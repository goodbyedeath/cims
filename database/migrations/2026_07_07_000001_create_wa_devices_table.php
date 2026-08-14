<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('wa_devices', function (Blueprint $table) {
            $table->id();
            $table->string('name');
            // Wablas account server, e.g. https://jkt.wablas.com — devices can
            // live on different regional servers within one account.
            $table->string('server_url')->default('https://jkt.wablas.com');
            // Encrypted at rest via model casts; TEXT because ciphertext is
            // much longer than the plain token.
            $table->text('token');
            $table->text('secret_key')->nullable();
            $table->string('phone', 30)->nullable();
            // Exactly one device should be active — it is the one used for all
            // outbound sending (blasts, chatbot replies, form tests).
            $table->boolean('is_active')->default(false)->index();
            // Cached gateway state from the last /api/device/info call, so the
            // page renders instantly without hitting Wablas on every load.
            $table->string('last_status', 30)->default('unknown');
            $table->json('last_info')->nullable();
            $table->timestamp('last_checked_at')->nullable();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('wa_devices');
    }
};
