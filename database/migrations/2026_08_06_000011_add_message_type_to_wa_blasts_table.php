<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Message type + media fields: text (default), image (media_url + caption in
 * `message`), or location (lat/lng + address in `message`). The send job
 * dispatches on `message_type`.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('wa_blasts', function (Blueprint $table) {
            $table->enum('message_type', ['text', 'image', 'location'])->default('text')->after('message');
            $table->string('media_url', 2048)->nullable()->after('message_type');
            $table->decimal('location_lat', 10, 7)->nullable()->after('media_url');
            $table->decimal('location_lng', 10, 7)->nullable()->after('location_lat');
        });
    }

    public function down(): void
    {
        Schema::table('wa_blasts', function (Blueprint $table) {
            $table->dropColumn(['message_type', 'media_url', 'location_lat', 'location_lng']);
        });
    }
};
