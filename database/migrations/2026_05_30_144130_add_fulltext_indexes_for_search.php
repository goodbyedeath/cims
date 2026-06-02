<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        // product_catalogs — title-tier and body-tier indexes for weighted scoring
        DB::statement('ALTER TABLE product_catalogs ADD FULLTEXT ft_catalog_title (product_name, brand, category)');
        DB::statement('ALTER TABLE product_catalogs ADD FULLTEXT ft_catalog_body  (product_name, brand, category, description)');

        // inventories — title-tier and body-tier indexes
        DB::statement('ALTER TABLE inventories ADD FULLTEXT ft_inventory_title (product, sku_no, kode_barang)');
        DB::statement('ALTER TABLE inventories ADD FULLTEXT ft_inventory_body  (product, sku_no, kode_barang, spesifikasi, notes)');
    }

    public function down(): void
    {
        DB::statement('ALTER TABLE product_catalogs DROP INDEX ft_catalog_title');
        DB::statement('ALTER TABLE product_catalogs DROP INDEX ft_catalog_body');
        DB::statement('ALTER TABLE inventories DROP INDEX ft_inventory_title');
        DB::statement('ALTER TABLE inventories DROP INDEX ft_inventory_body');
    }
};
