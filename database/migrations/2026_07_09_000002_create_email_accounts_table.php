<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('email_accounts', function (Blueprint $table) {
            $table->id();
            $table->string('name');                         // label, e.g. "Sales Utama"
            $table->string('email');                        // from address / SMTP login
            $table->string('from_name')->nullable();        // default sender display name
            $table->string('smtp_host')->default('smtp.hostinger.com');
            $table->unsignedSmallInteger('smtp_port')->default(465);
            $table->string('encryption', 10)->default('ssl');
            // SMTP password — encrypted at rest via model cast (TEXT: ciphertext
            // is much longer than the plain value).
            $table->text('password');
            // NULL = shared account every user may send from; set = personal
            // account visible only to that user (and admins).
            $table->foreignId('user_id')->nullable()->constrained()->cascadeOnDelete();
            $table->timestamps();
        });

        Schema::table('email_blasts', function (Blueprint $table) {
            // Which account sent the blast; NULL = the .env default mailer.
            $table->foreignId('email_account_id')->nullable()
                ->after('user_id')->constrained()->nullOnDelete();
        });
    }

    public function down(): void
    {
        Schema::table('email_blasts', function (Blueprint $table) {
            $table->dropConstrainedForeignId('email_account_id');
        });
        Schema::dropIfExists('email_accounts');
    }
};
