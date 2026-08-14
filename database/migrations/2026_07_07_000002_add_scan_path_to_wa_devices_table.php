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
            // Custom QR-connector endpoint template, relative to server_url.
            // "{token}" is replaced with the device token at request time.
            // NULL = the standard Wablas path (/api/device/scan?token={token}).
            $table->string('scan_path', 200)->nullable()->after('secret_key');
        });
    }

    public function down(): void
    {
        Schema::table('wa_devices', function (Blueprint $table) {
            $table->dropColumn('scan_path');
        });
    }
};
