<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        // Extend the enum to include 'cancelled'
        DB::statement("ALTER TABLE payments MODIFY COLUMN payment_status ENUM('unpaid','partial','paid','cancelled') NOT NULL DEFAULT 'unpaid'");

        // Mark payments whose order has been soft-deleted as cancelled
        DB::statement("
            UPDATE payments p
            INNER JOIN orders o ON o.id = p.order_id
            SET p.payment_status = 'cancelled'
            WHERE o.deleted_at IS NOT NULL
        ");
    }

    public function down(): void
    {
        // Revert cancelled → unpaid before shrinking the enum back
        DB::statement("UPDATE payments SET payment_status = 'unpaid' WHERE payment_status = 'cancelled'");
        DB::statement("ALTER TABLE payments MODIFY COLUMN payment_status ENUM('unpaid','partial','paid') NOT NULL DEFAULT 'unpaid'");
    }
};
