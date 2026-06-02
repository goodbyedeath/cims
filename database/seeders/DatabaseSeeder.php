<?php

namespace Database\Seeders;

use App\Models\AiScore;
use App\Models\Channel;
use App\Models\ChannelLog;
use App\Models\Installment;
use App\Models\Order;
use App\Models\OrderItem;
use App\Models\Payment;
use App\Models\Product;
use App\Models\User;
use App\Services\AiScoringService;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;

class DatabaseSeeder extends Seeder
{
    public function run(): void
    {
        // Users
        $admin = User::create([
            'name' => 'Admin CIMS',
            'email' => 'admin@cims.com',
            'phone' => '081234567890',
            'password' => Hash::make('password'),
            'role' => 'admin',
            'status' => 'active',
        ]);

        $spv1 = User::create([
            'name' => 'Budi Santoso',
            'email' => 'budi@cims.com',
            'phone' => '081234567891',
            'password' => Hash::make('password'),
            'role' => 'spv',
            'status' => 'active',
        ]);

        $spv2 = User::create([
            'name' => 'Siti Rahayu',
            'email' => 'siti@cims.com',
            'phone' => '081234567892',
            'password' => Hash::make('password'),
            'role' => 'spv',
            'status' => 'active',
        ]);

        $downlines = [];
        $salesNames = ['Andi Pratama', 'Dewi Lestari', 'Rizky Maulana', 'Putri Ayu', 'Fajar Hidayat', 'Rina Oktaviani'];
        foreach ($salesNames as $i => $name) {
            $downlines[] = User::create([
                'name' => $name,
                'email' => strtolower(str_replace(' ', '.', $name)) . '@cims.com',
                'phone' => '08123456' . str_pad($i + 10, 4, '0', STR_PAD_LEFT),
                'password' => Hash::make('password'),
                'role' => 'downline',
                'spv_id' => $i < 3 ? $spv1->id : $spv2->id,
                'status' => 'active',
            ]);
        }

        // Products
        $products = [];
        $productData = [
            ['SKU-001', 'Premium Widget A', 'Electronics', 150000],
            ['SKU-002', 'Standard Widget B', 'Electronics', 95000],
            ['SKU-003', 'Economy Widget C', 'Electronics', 65000],
            ['SKU-004', 'Connector Pro X1', 'Parts', 45000],
            ['SKU-005', 'Cable Assembly Kit', 'Parts', 78000],
            ['SKU-006', 'Motor Unit MK3', 'Machinery', 350000],
            ['SKU-007', 'Bearing Set HD', 'Machinery', 125000],
            ['SKU-008', 'Lubricant Industrial 5L', 'Supplies', 89000],
            ['SKU-009', 'Safety Gloves Pack', 'Supplies', 35000],
            ['SKU-010', 'Control Board V2', 'Electronics', 275000],
        ];

        foreach ($productData as $p) {
            $products[] = Product::create([
                'sku' => $p[0],
                'name' => $p[1],
                'category' => $p[2],
                'price' => $p[3],
            ]);
        }

        // Channels
        $provinces = ['Jawa Barat', 'Jawa Tengah', 'Jawa Timur', 'DKI Jakarta', 'Banten'];
        $cities = [
            'Jawa Barat' => ['Bandung', 'Bekasi', 'Bogor', 'Depok', 'Cimahi'],
            'Jawa Tengah' => ['Semarang', 'Solo', 'Pekalongan'],
            'Jawa Timur' => ['Surabaya', 'Malang', 'Sidoarjo'],
            'DKI Jakarta' => ['Jakarta Selatan', 'Jakarta Barat', 'Jakarta Utara'],
            'Banten' => ['Tangerang', 'Serang', 'Cilegon'],
        ];

        // Approximate coordinates for cities
        $coords = [
            'Bandung' => [-6.9175, 107.6191], 'Bekasi' => [-6.2383, 106.9756],
            'Bogor' => [-6.5971, 106.8060], 'Depok' => [-6.4025, 106.7942],
            'Cimahi' => [-6.8841, 107.5413], 'Semarang' => [-6.9666, 110.4196],
            'Solo' => [-7.5755, 110.8243], 'Pekalongan' => [-6.8886, 109.6753],
            'Surabaya' => [-7.2575, 112.7521], 'Malang' => [-7.9666, 112.6326],
            'Sidoarjo' => [-7.4478, 112.7183], 'Jakarta Selatan' => [-6.2615, 106.8106],
            'Jakarta Barat' => [-6.1683, 106.7588], 'Jakarta Utara' => [-6.1384, 106.8637],
            'Tangerang' => [-6.1781, 106.6319], 'Serang' => [-6.1103, 106.1502],
            'Cilegon' => [-6.0172, 106.0562],
        ];

        $channels = [];
        $companyNames = [
            'PT Maju Bersama', 'CV Sejahtera Abadi', 'PT Sinar Terang', 'UD Makmur Jaya',
            'PT Global Teknik', 'CV Karya Utama', 'PT Indo Mesin', 'UD Sukses Mandiri',
            'PT Mega Industri', 'CV Bintang Timur', 'PT Perkasa Motor', 'UD Harapan Baru',
            'PT Cipta Karya', 'CV Mitra Solusi', 'PT Nusantara Parts', 'UD Gemilang',
            'PT Teknologi Prima', 'CV Abadi Teknik', 'PT Surya Kencana', 'UD Jaya Sentosa',
            'PT Delta Mekanik', 'CV Harmoni Industri', 'PT Bumi Perkasa', 'UD Anugerah',
            'PT Kreasi Logam', 'CV Mandala Teknik', 'PT Sentosa Electric', 'UD Berkah Abadi',
            'PT Andalas Motor', 'CV Prima Usaha',
        ];

        foreach ($companyNames as $i => $company) {
            $province = $provinces[array_rand($provinces)];
            $cityList = $cities[$province];
            $city = $cityList[array_rand($cityList)];
            $coord = $coords[$city] ?? [-6.2, 106.8];

            $channels[] = Channel::create([
                'channel_code' => 'CH-' . str_pad($i + 1, 4, '0', STR_PAD_LEFT),
                'company_name' => $company,
                'owner_name' => fake()->name(),
                'purchasing_staff' => $i % 3 === 0 ? fake()->name() : null,
                'phone' => '021' . rand(10000000, 99999999),
                'email' => strtolower(str_replace([' ', '.'], '', $company)) . '@email.com',
                'address' => fake()->streetAddress(),
                'province' => $province,
                'city' => $city,
                'district' => fake()->citySuffix(),
                'latitude' => $coord[0] + (rand(-100, 100) / 10000),
                'longitude' => $coord[1] + (rand(-100, 100) / 10000),
                'assigned_user_id' => $downlines[array_rand($downlines)]->id,
                'status' => $i < 25 ? 'active' : ($i < 28 ? 'inactive' : 'blacklist'),
            ]);
        }

        // Orders (generate ~100 orders spread over last 12 months)
        $statuses = ['pending', 'confirmed', 'process', 'delivered', 'delivered', 'delivered', 'cancel'];

        for ($i = 0; $i < 120; $i++) {
            $channel = $channels[array_rand($channels)];
            $orderDate = now()->subDays(rand(0, 365));
            $status = $statuses[array_rand($statuses)];
            $itemCount = rand(1, 4);
            $subtotal = 0;
            $items = [];

            for ($j = 0; $j < $itemCount; $j++) {
                $product = $products[array_rand($products)];
                $qty = rand(1, 20);
                $price = $product->price;
                $total = $qty * $price;
                $subtotal += $total;
                $items[] = [
                    'product_id' => $product->id,
                    'qty' => $qty,
                    'price' => $price,
                    'total' => $total,
                ];
            }

            $discount = rand(0, 1) ? rand(10000, 100000) : 0;
            $tax = round($subtotal * 0.11);
            $grandTotal = $subtotal - $discount + $tax;

            $order = Order::create([
                'order_no' => 'ORD-' . strtoupper(Str::random(8)),
                'channel_id' => $channel->id,
                'sales_id' => $downlines[array_rand($downlines)]->id,
                'order_date' => $orderDate,
                'delivery_date' => $status === 'delivered' ? $orderDate->addDays(rand(3, 14)) : null,
                'status' => $status,
                'payment_method' => ['cash', 'transfer', 'credit'][array_rand(['cash', 'transfer', 'credit'])],
                'subtotal' => $subtotal,
                'discount' => $discount,
                'tax' => $tax,
                'grand_total' => $grandTotal,
            ]);

            foreach ($items as $item) {
                OrderItem::create(array_merge($item, ['order_id' => $order->id]));
            }

            // Payment
            $isCash = rand(0, 1);
            $dp = $isCash ? $grandTotal : round($grandTotal * rand(20, 50) / 100);
            $remaining = max(0, $grandTotal - $dp);

            $paymentStatus = $status === 'delivered' && $remaining === 0 ? 'paid' : ($dp > 0 ? 'partial' : 'unpaid');
            if ($status === 'delivered' && rand(0, 3) === 0) $paymentStatus = 'paid';

            $payment = Payment::create([
                'order_id' => $order->id,
                'type_order' => $isCash ? 'cash' : 'installment',
                'dp' => $dp,
                'remaining_debt' => $paymentStatus === 'paid' ? 0 : $remaining,
                'installment_count' => $isCash ? 0 : rand(2, 6),
                'payment_status' => $paymentStatus,
            ]);

            // Installments
            if (!$isCash && $remaining > 0) {
                $count = $payment->installment_count;
                $installmentAmount = $remaining / max(1, $count);

                for ($k = 1; $k <= $count; $k++) {
                    $dueDate = $orderDate->copy()->addMonths($k);
                    $isPaid = $dueDate->isPast() && rand(0, 2) > 0;
                    $isLate = !$isPaid && $dueDate->isPast();

                    Installment::create([
                        'payment_id' => $payment->id,
                        'installment_no' => $k,
                        'due_date' => $dueDate,
                        'amount' => round($installmentAmount),
                        'percentage' => round(100 / $count, 2),
                        'status' => $isPaid ? 'paid' : ($isLate ? 'late' : 'unpaid'),
                        'paid_date' => $isPaid ? $dueDate->addDays(rand(0, 5)) : null,
                    ]);
                }
            }

            // Update channel counters
            if ($status === 'delivered') $channel->increment('successful_order');
            elseif ($status === 'cancel') $channel->increment('cancelation_order');
            elseif ($status === 'pending') $channel->increment('pending_order');
        }

        // Channel logs
        foreach ($channels as $channel) {
            ChannelLog::create([
                'channel_id' => $channel->id,
                'user_id' => $admin->id,
                'activity' => 'Channel registered in system',
            ]);
        }

        // Run AI scoring
        $service = new AiScoringService();
        $service->scoreAllChannels();

        $this->command->info('Seeded: Users, Products, Channels, Orders, Payments, AI Scores');
    }
}
