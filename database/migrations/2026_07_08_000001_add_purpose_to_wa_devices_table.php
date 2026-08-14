<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('wa_devices', function (Blueprint $table) {
            // Traffic split so bulk sending can't get the transactional number
            // banned: 'general' handles everything, 'otp' is preferred for
            // verification/transactional messages, 'blast' for bulk campaigns.
            // One device may be active per purpose; resolution falls back
            // purpose → general → any active → .env.
            $table->string('purpose', 20)->default('general')->after('name')->index();
        });
    }

    public function down(): void
    {
        Schema::table('wa_devices', function (Blueprint $table) {
            $table->dropColumn('purpose');
        });
    }
};
