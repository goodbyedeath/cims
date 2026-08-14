<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // Native WhatsApp interactive "forms" (button / list messages).
        Schema::create('wa_forms', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->nullable()->constrained()->nullOnDelete();
            $table->string('title', 100);
            $table->enum('type', ['button', 'list'])->default('button');
            $table->string('header', 60)->nullable();
            $table->text('body');
            $table->string('footer', 60)->nullable();
            $table->string('button_label', 24)->nullable(); // list: the text that opens the list
            // button: [{id,text}, ...] (max 3) | list: [{title, rows:[{id,title,description}]}]
            $table->json('items');
            $table->boolean('is_active')->default(true);
            $table->timestamps();

            $table->index('is_active');
        });

        // Keyword auto-reply rules for the chatbot.
        Schema::create('wa_bot_rules', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->nullable()->constrained()->nullOnDelete();
            $table->string('name', 100);
            // 'default' = catch-all fallback when nothing else matches
            $table->enum('match_type', ['exact', 'contains', 'starts_with', 'default'])->default('contains');
            $table->string('keyword', 255)->nullable(); // comma-separated keywords; null for 'default'
            $table->enum('reply_type', ['text', 'form'])->default('text');
            $table->text('reply_message')->nullable();
            $table->foreignId('wa_form_id')->nullable()->constrained('wa_forms')->nullOnDelete();
            $table->unsignedInteger('priority')->default(0); // higher = checked first
            $table->boolean('is_active')->default(true);
            $table->unsignedInteger('hit_count')->default(0);
            $table->timestamp('last_hit_at')->nullable();
            $table->timestamps();

            $table->index(['is_active', 'priority']);
            $table->index('match_type');
        });

        // Inbound message log / inbox.
        Schema::create('wa_inbound_messages', function (Blueprint $table) {
            $table->id();
            $table->string('phone', 30);
            $table->foreignId('channel_id')->nullable()->constrained()->nullOnDelete();
            $table->text('message')->nullable();
            $table->foreignId('matched_rule_id')->nullable()->constrained('wa_bot_rules')->nullOnDelete();
            $table->boolean('reply_sent')->default(false);
            $table->text('reply_text')->nullable();
            $table->string('reply_error')->nullable();
            $table->json('raw')->nullable();
            $table->timestamps();

            $table->index('phone');
            $table->index('created_at');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('wa_inbound_messages');
        Schema::dropIfExists('wa_bot_rules');
        Schema::dropIfExists('wa_forms');
    }
};
