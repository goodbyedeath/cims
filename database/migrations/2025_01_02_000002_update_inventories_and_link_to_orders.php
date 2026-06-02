<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // Update inventories: add qty (nullable = infinite), change m1 to decimal (price)
        Schema::table('inventories', function (Blueprint $table) {
            $table->unsignedInteger('qty')->nullable()->after('notes'); // null = infinite
        });

        // Change m1 from unsigned integer to decimal price
        Schema::table('inventories', function (Blueprint $table) {
            $table->decimal('m1', 15, 2)->default(0)->change();
        });

        // Clear existing order_items (dev data) to allow FK change
        DB::table('order_items')->truncate();

        // Change order_items: replace product_id with inventory_id
        Schema::table('order_items', function (Blueprint $table) {
            $table->dropForeign(['product_id']);
            $table->dropColumn('product_id');
            $table->foreignId('inventory_id')->after('order_id')->constrained('inventories')->restrictOnDelete();
        });
    }

    public function down(): void
    {
        DB::table('order_items')->truncate();

        Schema::table('order_items', function (Blueprint $table) {
            $table->dropForeign(['inventory_id']);
            $table->dropColumn('inventory_id');
            $table->foreignId('product_id')->after('order_id')->constrained()->restrictOnDelete();
        });

        Schema::table('inventories', function (Blueprint $table) {
            $table->unsignedInteger('m1')->default(0)->change();
            $table->dropColumn('qty');
        });
    }
};
