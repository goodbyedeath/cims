<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('product_catalogs', function (Blueprint $table) {
            $table->id();
            $table->string('brand', 100);
            $table->string('category', 100);
            $table->string('product_name', 255);
            $table->text('description')->nullable();
            $table->decimal('best_price', 15, 2)->default(0);
            $table->integer('moq')->default(1);
            $table->string('image_path', 500)->nullable();
            $table->enum('status', ['active', 'inactive'])->default('active');
            $table->integer('sort_order')->default(0);
            $table->timestamps();

            $table->index('status');
            $table->index('category');
            $table->index('brand');
            $table->index('sort_order');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('product_catalogs');
    }
};
