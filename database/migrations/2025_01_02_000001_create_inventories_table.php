<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('inventories', function (Blueprint $table) {
            $table->id();
            $table->string('sku_no', 50)->unique();
            $table->string('product');
            $table->string('kode_barang', 50);
            $table->text('spesifikasi')->nullable();
            $table->text('notes')->nullable();
            $table->decimal('srp', 15, 2)->default(0);
            $table->unsignedInteger('m1')->default(0);
            $table->timestamps();

            $table->index('kode_barang');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('inventories');
    }
};
