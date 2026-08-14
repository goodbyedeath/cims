<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('email_blasts', function (Blueprint $table) {
            $table->string('sender_name')->nullable()->after('subject');
        });
    }

    public function down(): void
    {
        Schema::table('email_blasts', function (Blueprint $table) {
            $table->dropColumn('sender_name');
        });
    }
};
