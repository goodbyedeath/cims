<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::table('channels', function (Blueprint $table) {
            $table->boolean('email_unsubscribed')->default(false)->after('email_invalid');
            $table->timestamp('email_unsubscribed_at')->nullable()->after('email_unsubscribed');
        });
    }

    public function down(): void
    {
        Schema::table('channels', function (Blueprint $table) {
            $table->dropColumn(['email_unsubscribed', 'email_unsubscribed_at']);
        });
    }
};
