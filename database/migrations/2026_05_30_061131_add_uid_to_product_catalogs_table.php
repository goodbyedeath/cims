<?php

declare(strict_types=1);

use App\Models\ProductCatalog;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Str;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('product_catalogs', function (Blueprint $table) {
            $table->string('uid', 26)->nullable()->unique()->after('id');
        });

        // Backfill existing rows
        ProductCatalog::whereNull('uid')->each(function (ProductCatalog $catalog) {
            $catalog->updateQuietly(['uid' => Str::ulid()]);
        });

        Schema::table('product_catalogs', function (Blueprint $table) {
            $table->string('uid', 26)->nullable(false)->change();
        });
    }

    public function down(): void
    {
        Schema::table('product_catalogs', function (Blueprint $table) {
            $table->dropUnique(['uid']);
            $table->dropColumn('uid');
        });
    }
};
