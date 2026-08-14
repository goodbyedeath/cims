<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('product_catalogs', function (Blueprint $table) {
            // Per-product override for the registered-channel special price.
            // NULL = follow the global CatalogSetting 'special_discount_pct';
            // a value (incl. 0) overrides it for this product only.
            $table->decimal('special_discount_pct', 5, 2)->nullable()->after('best_price');
        });
    }

    public function down(): void
    {
        Schema::table('product_catalogs', function (Blueprint $table) {
            $table->dropColumn('special_discount_pct');
        });
    }
};
