<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('product_catalogs', function (Blueprint $table) {
            $table->json('selling_points')->nullable()->after('description');
            $table->text('application_scenario')->nullable()->after('selling_points');
            $table->boolean('is_featured')->default(false)->after('sort_order');
        });
    }

    public function down(): void
    {
        Schema::table('product_catalogs', function (Blueprint $table) {
            $table->dropColumn(['selling_points', 'application_scenario', 'is_featured']);
        });
    }
};
