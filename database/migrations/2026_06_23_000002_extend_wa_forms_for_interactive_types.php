<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // Expand the supported WhatsApp interactive message types:
        //   button       — Reply Buttons (≤3)
        //   list         — List Messages
        //   product      — Single Product Message
        //   product_list — Multi-Product Message
        //   flow         — Interactive Flow
        DB::statement(
            "ALTER TABLE wa_forms MODIFY type "
            ."ENUM('button','list','product','product_list','flow') NOT NULL DEFAULT 'button'"
        );

        Schema::table('wa_forms', function (Blueprint $table) {
            // Type-specific scalars: catalog_id, product_retailer_id (single),
            // flow_id, flow_cta, flow_screen, flow_action.
            $table->json('config')->nullable()->after('items');
            // 'items' holds buttons / list sections / product_list sections;
            // empty for single-product & flow which use 'config'.
            $table->json('items')->nullable()->change();
        });
    }

    public function down(): void
    {
        Schema::table('wa_forms', function (Blueprint $table) {
            $table->dropColumn('config');
        });

        DB::statement(
            "ALTER TABLE wa_forms MODIFY type ENUM('button','list') NOT NULL DEFAULT 'button'"
        );
    }
};
