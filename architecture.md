# CIMS AI Integration Architecture (Ollama - Local AI)

## Overview

Add an AI Assistant to CIMS that users can interact with via natural language chat.
The AI reads/writes CIMS data through internal action handlers.
Powered by **Ollama** (local LLM, free, no API key, fully offline).

### Why Ollama
- Free, no API costs
- Runs 100% local on your machine
- No data leaves your computer
- Fast response for 7B-14B models
- Supports structured JSON output

### Recommended Models
| Model              | Size  | RAM Needed | Best For                    |
|--------------------|-------|------------|-----------------------------|
| `qwen2.5:7b`      | ~4GB  | 8GB RAM    | Good balance speed/quality  |
| `qwen2.5:14b`     | ~8GB  | 16GB RAM   | Better reasoning            |
| `llama3.1:8b`     | ~4GB  | 8GB RAM    | General purpose             |
| `mistral:7b`      | ~4GB  | 8GB RAM    | Fast, lightweight           |

---

## System Design

```
User Chat Input
     |
     v
+------------------+      +-------------------+
|  React Frontend  | ---> |  AiChatController |
|  (Chat Widget)   | <--- |  POST /ai/chat    |
+------------------+      +-------------------+
                                  |
                                  v
                          +----------------+
                          |  AiChatService |
                          |  (Orchestrator)|
                          +----------------+
                                  |
                      +-----------+-----------+
                      |                       |
                      v                       v
              +---------------+     +------------------+
              |  Ollama API   |     |  Action Handlers |
              |  localhost:    |     |  (Read/Write DB) |
              |  11434        |     +------------------+
              +---------------+              |
                      |                      v
                      v              Eloquent Models
              JSON response with     (Channel, Order,
              action commands        Inventory, etc.)
```

### How It Works (Ollama Flow)

Unlike Claude API which has native tool-use, Ollama uses a **structured prompt pattern**:

1. User sends message
2. Service builds a prompt with system instructions + available actions list
3. Ollama returns JSON with `action` (tool to call) + `params` + `message`
4. Service parses JSON, executes the action against the database
5. Service sends action result back to Ollama for a final human-readable answer
6. Final response returned to frontend

---

## Implementation Steps

### STEP 0: Install Ollama

```bash
# Download from https://ollama.com/download (Windows)
# After install, pull a model:
ollama pull qwen2.5:7b

# Verify it's running:
curl http://localhost:11434/api/tags
```

Add to `.env`:
```
OLLAMA_HOST=http://localhost:11434
OLLAMA_MODEL=qwen2.5:7b
```

Add to `config/services.php`:
```php
'ollama' => [
    'host' => env('OLLAMA_HOST', 'http://localhost:11434'),
    'model' => env('OLLAMA_MODEL', 'qwen2.5:7b'),
],
```

---

### STEP 1: Backend

#### 1.1 Create Migration - Chat History

File: `database/migrations/xxxx_create_ai_chats_table.php`

```php
Schema::create('ai_chats', function (Blueprint $table) {
    $table->id();
    $table->foreignId('user_id')->constrained()->cascadeOnDelete();
    $table->text('message');
    $table->text('response');
    $table->json('actions')->nullable();
    $table->timestamps();
});
```

#### 1.2 Create Model

File: `app/Models/AiChat.php`

```php
<?php

declare(strict_types=1);

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class AiChat extends Model
{
    protected $fillable = ['user_id', 'message', 'response', 'actions'];

    protected function casts(): array
    {
        return ['actions' => 'array'];
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}
```

#### 1.3 Create AiChatService (Core Orchestrator)

File: `app/Services/AiChatService.php`

```php
<?php

declare(strict_types=1);

namespace App\Services;

use App\Models\AiChat;
use App\Models\Channel;
use App\Models\Installment;
use App\Models\Inventory;
use App\Models\Order;
use App\Models\Payment;
use App\Models\User;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

class AiChatService
{
    private string $host;
    private string $model;

    public function __construct()
    {
        $this->host = config('services.ollama.host', 'http://localhost:11434');
        $this->model = config('services.ollama.model', 'qwen2.5:7b');
    }

    public function chat(string $message, int $userId): array
    {
        // Load recent history for context
        $history = AiChat::where('user_id', $userId)
            ->latest()->limit(10)->get()->reverse()->values();

        $conversationHistory = '';
        foreach ($history as $chat) {
            $conversationHistory .= "User: {$chat->message}\nAssistant: {$chat->response}\n\n";
        }

        // PHASE 1: Ask Ollama to decide what action to take
        $actionPrompt = $this->buildActionPrompt($message, $conversationHistory, $userId);
        $actionResponse = $this->callOllama($actionPrompt, true); // JSON mode

        // Parse the action JSON
        $parsed = $this->parseActionResponse($actionResponse);
        $actions = [];
        $actionResult = null;

        // Execute action if any
        if ($parsed['action'] && $parsed['action'] !== 'none') {
            $actionResult = $this->executeTool($parsed['action'], $parsed['params'] ?? []);
            $actions[] = [
                'tool' => $parsed['action'],
                'input' => $parsed['params'] ?? [],
                'result' => $actionResult,
            ];
        }

        // PHASE 2: Ask Ollama to write a human-friendly response
        $responsePrompt = $this->buildResponsePrompt(
            $message, $parsed, $actionResult, $conversationHistory
        );
        $finalResponse = $this->callOllama($responsePrompt, false);

        // Save to history
        AiChat::create([
            'user_id' => $userId,
            'message' => $message,
            'response' => $finalResponse,
            'actions' => $actions ?: null,
        ]);

        return [
            'response' => $finalResponse,
            'actions' => $actions,
        ];
    }

    private function callOllama(string $prompt, bool $jsonMode = false): string
    {
        $payload = [
            'model' => $this->model,
            'prompt' => $prompt,
            'stream' => false,
            'options' => [
                'temperature' => 0.3,
                'num_predict' => 2048,
            ],
        ];

        if ($jsonMode) {
            $payload['format'] = 'json';
        }

        $response = Http::timeout(120)
            ->post("{$this->host}/api/generate", $payload);

        return trim($response->json('response', ''));
    }

    private function buildActionPrompt(string $message, string $history, int $userId): string
    {
        $user = User::find($userId);
        $date = now()->format('Y-m-d');

        return <<<PROMPT
You are CIMS AI Assistant for a Channel Management System.
Current user: {$user->name} (role: {$user->role})
Current date: {$date}

CONVERSATION HISTORY:
{$history}

USER MESSAGE: {$message}

AVAILABLE ACTIONS:
- get_dashboard_stats: Get summary statistics. Params: none
- list_channels: List/search channels. Params: {"search":"...", "status":"active|inactive", "grade":"platinum|gold|silver|bronze|risk", "limit":20}
- get_channel: Get channel detail. Params: {"id": 1}
- list_orders: List/search orders. Params: {"search":"...", "status":"pending|confirmed|process|delivered|cancel", "limit":20}
- get_order: Get order detail. Params: {"id": 1}
- list_inventory: Search inventory. Params: {"search":"...", "limit":30}
- list_payments: List payments. Params: {"status":"paid|partial|unpaid", "limit":20}
- get_overdue_payments: Get overdue installments. Params: none
- create_channel: Create channel. Params: {"channel_code":"CH-XXX", "company_name":"...", "owner_name":"...", "phone":"...", "address":"...", "province":"...", "city":"...", "status":"active"}
- update_channel: Update channel. Params: {"id":1, "company_name":"...", ...fields to update}
- update_order_status: Change order status. Params: {"id":1, "status":"confirmed|process|delivered|cancel"}
- create_inventory: Add inventory. Params: {"sku_no":"...", "product":"...", "kode_barang":"...", "spesifikasi":"...", "notes":"...", "qty":null, "srp":0, "m1":0}
- update_inventory: Update inventory. Params: {"id":1, ...fields to update}
- pay_installment: Mark installment paid. Params: {"id": 1}
- recalculate_ai_scores: Recalculate all AI scores. Params: none
- query_analytics: Run analytics. Params: {"type":"revenue_by_month|top_channels|order_summary|inventory_low_stock", "limit":10, "threshold":10}
- none: No action needed (just conversation/greeting/question)

Respond with JSON only:
{"action": "action_name_or_none", "params": {}, "reasoning": "why this action"}

If the user is just greeting, asking a question that needs no data, or you need clarification, use action "none".
If write action is requested but details are unclear, use action "none" and explain what info you need in reasoning.
PROMPT;
    }

    private function buildResponsePrompt(
        string $message, array $parsed, mixed $actionResult, string $history
    ): string {
        $actionInfo = '';
        if ($parsed['action'] && $parsed['action'] !== 'none') {
            $resultJson = json_encode($actionResult, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE);
            $actionInfo = <<<INFO

ACTION EXECUTED: {$parsed['action']}
ACTION PARAMS: {$this->jsonEncode($parsed['params'] ?? [])}
ACTION RESULT:
{$resultJson}
INFO;
        }

        return <<<PROMPT
You are CIMS AI Assistant. Respond in Bahasa Indonesia unless the user writes in English.
Keep responses concise and helpful. Format currency as Rupiah (e.g. Rp 150.000).
Use simple formatting, no markdown tables (use numbered lists instead).

CONVERSATION HISTORY:
{$history}

USER MESSAGE: {$message}
{$actionInfo}

Write a helpful response to the user based on the action result above.
If no action was executed, respond conversationally.
Do not mention internal action names or JSON - speak naturally.
PROMPT;
    }

    private function parseActionResponse(string $response): array
    {
        $decoded = json_decode($response, true);

        if (!$decoded || !isset($decoded['action'])) {
            return ['action' => 'none', 'params' => [], 'reasoning' => ''];
        }

        return [
            'action' => $decoded['action'] ?? 'none',
            'params' => $decoded['params'] ?? [],
            'reasoning' => $decoded['reasoning'] ?? '',
        ];
    }

    private function jsonEncode(mixed $data): string
    {
        return json_encode($data, JSON_UNESCAPED_UNICODE);
    }

    // ===================================================
    // TOOL IMPLEMENTATIONS
    // ===================================================

    private function executeTool(string $name, array $input): mixed
    {
        try {
            return match ($name) {
                'get_dashboard_stats'   => $this->getDashboardStats(),
                'list_channels'         => $this->listChannels($input),
                'get_channel'           => $this->getChannel($input),
                'list_orders'           => $this->listOrders($input),
                'get_order'             => $this->getOrder($input),
                'list_inventory'        => $this->listInventory($input),
                'list_payments'         => $this->listPayments($input),
                'get_overdue_payments'  => $this->getOverduePayments(),
                'create_channel'        => $this->createChannel($input),
                'update_channel'        => $this->updateChannel($input),
                'update_order_status'   => $this->updateOrderStatus($input),
                'create_inventory'      => $this->createInventory($input),
                'update_inventory'      => $this->updateInventory($input),
                'pay_installment'       => $this->payInstallment($input),
                'recalculate_ai_scores' => $this->recalculateAiScores(),
                'query_analytics'       => $this->queryAnalytics($input),
                default => ['error' => "Unknown action: {$name}"],
            };
        } catch (\Throwable $e) {
            Log::error("AI Tool Error [{$name}]: {$e->getMessage()}");
            return ['error' => $e->getMessage()];
        }
    }

    // --- READ ---

    private function getDashboardStats(): array
    {
        $now = now();
        return [
            'total_channels'    => Channel::count(),
            'active_channels'   => Channel::where('status', 'active')->count(),
            'monthly_revenue'   => (float) Order::where('status', 'delivered')
                ->whereMonth('order_date', $now->month)
                ->whereYear('order_date', $now->year)
                ->sum('grand_total'),
            'pending_orders'    => Order::where('status', 'pending')->count(),
            'total_orders'      => Order::count(),
            'outstanding_debt'  => (float) Payment::where('payment_status', '!=', 'paid')
                ->sum('remaining_debt'),
            'total_inventory'   => Inventory::count(),
        ];
    }

    private function listChannels(array $input): array
    {
        return Channel::query()
            ->when($input['search'] ?? null, fn($q, $s) =>
                $q->where('company_name', 'like', "%{$s}%")
                  ->orWhere('channel_code', 'like', "%{$s}%")
                  ->orWhere('owner_name', 'like', "%{$s}%"))
            ->when($input['status'] ?? null, fn($q, $s) => $q->where('status', $s))
            ->when($input['grade'] ?? null, fn($q, $g) => $q->where('channel_grade', $g))
            ->orderByDesc('performance_score')
            ->limit((int) ($input['limit'] ?? 20))
            ->get(['id','channel_code','company_name','owner_name','status',
                   'channel_grade','performance_score','province','city'])
            ->toArray();
    }

    private function getChannel(array $input): array
    {
        $channel = Channel::with(['assignedUser:id,name', 'aiScore'])->find($input['id']);
        return $channel ? $channel->toArray() : ['error' => 'Channel not found'];
    }

    private function listOrders(array $input): array
    {
        return Order::with('channel:id,channel_code,company_name')
            ->when($input['search'] ?? null, fn($q, $s) =>
                $q->where('order_no', 'like', "%{$s}%"))
            ->when($input['status'] ?? null, fn($q, $s) => $q->where('status', $s))
            ->latest('order_date')
            ->limit((int) ($input['limit'] ?? 20))
            ->get(['id','order_no','channel_id','order_date','status','grand_total'])
            ->toArray();
    }

    private function getOrder(array $input): array
    {
        $order = Order::with([
            'channel:id,channel_code,company_name',
            'items.inventory:id,sku_no,product',
            'payment.installments',
        ])->find($input['id']);
        return $order ? $order->toArray() : ['error' => 'Order not found'];
    }

    private function listInventory(array $input): array
    {
        return Inventory::query()
            ->when($input['search'] ?? null, fn($q, $s) =>
                $q->where('sku_no', 'like', "%{$s}%")
                  ->orWhere('product', 'like', "%{$s}%")
                  ->orWhere('kode_barang', 'like', "%{$s}%"))
            ->limit((int) ($input['limit'] ?? 30))
            ->get(['id','sku_no','product','kode_barang','qty','srp','m1'])
            ->toArray();
    }

    private function listPayments(array $input): array
    {
        return Payment::with('order:id,order_no,channel_id')
            ->when($input['status'] ?? null, fn($q, $s) => $q->where('payment_status', $s))
            ->latest()
            ->limit((int) ($input['limit'] ?? 20))
            ->get(['id','order_id','type_order','dp','remaining_debt',
                   'installment_count','payment_status'])
            ->toArray();
    }

    private function getOverduePayments(): array
    {
        return Installment::with('payment.order:id,order_no')
            ->where('status', 'unpaid')
            ->where('due_date', '<', now())
            ->get(['id','payment_id','installment_no','due_date','amount','status'])
            ->toArray();
    }

    // --- WRITE ---

    private function createChannel(array $input): array
    {
        $channel = Channel::create([
            'channel_code'  => $input['channel_code'],
            'company_name'  => $input['company_name'],
            'owner_name'    => $input['owner_name'] ?? null,
            'phone'         => $input['phone'] ?? null,
            'address'       => $input['address'] ?? null,
            'province'      => $input['province'] ?? null,
            'city'          => $input['city'] ?? null,
            'status'        => $input['status'] ?? 'active',
        ]);
        return ['success' => true, 'id' => $channel->id, 'channel_code' => $channel->channel_code];
    }

    private function updateChannel(array $input): array
    {
        $channel = Channel::findOrFail($input['id']);
        $fields = collect($input)->except('id')->toArray();
        $channel->update($fields);
        return ['success' => true, 'id' => $channel->id, 'updated_fields' => array_keys($fields)];
    }

    private function updateOrderStatus(array $input): array
    {
        $order = Order::findOrFail($input['id']);
        $oldStatus = $order->status;
        $order->update(['status' => $input['status']]);

        // Update channel counters
        if ($channel = $order->channel) {
            if ($oldStatus === 'pending') $channel->decrement('pending_order');
            if ($input['status'] === 'delivered') $channel->increment('successful_order');
            elseif ($input['status'] === 'cancel') $channel->increment('cancelation_order');
        }

        return ['success' => true, 'order_no' => $order->order_no, 'old_status' => $oldStatus, 'new_status' => $input['status']];
    }

    private function createInventory(array $input): array
    {
        $item = Inventory::create([
            'sku_no'      => $input['sku_no'],
            'product'     => $input['product'],
            'kode_barang' => $input['kode_barang'] ?? '',
            'spesifikasi' => $input['spesifikasi'] ?? null,
            'notes'       => $input['notes'] ?? null,
            'qty'         => $input['qty'] ?? null,
            'srp'         => (float) ($input['srp'] ?? 0),
            'm1'          => (float) ($input['m1'] ?? 0),
        ]);
        return ['success' => true, 'id' => $item->id, 'sku_no' => $item->sku_no];
    }

    private function updateInventory(array $input): array
    {
        $item = Inventory::findOrFail($input['id']);
        $fields = collect($input)->except('id')->toArray();
        $item->update($fields);
        return ['success' => true, 'id' => $item->id, 'updated_fields' => array_keys($fields)];
    }

    private function payInstallment(array $input): array
    {
        $installment = Installment::findOrFail($input['id']);
        $installment->update(['status' => 'paid', 'paid_date' => now()->toDateString()]);

        // Check if all installments paid
        $payment = $installment->payment;
        $allPaid = $payment->installments()->where('status', '!=', 'paid')->count() === 0;
        if ($allPaid) {
            $payment->update(['payment_status' => 'paid', 'remaining_debt' => 0]);
        } else {
            $payment->decrement('remaining_debt', $installment->amount);
        }

        return ['success' => true, 'installment_no' => $installment->installment_no, 'all_paid' => $allPaid];
    }

    private function recalculateAiScores(): array
    {
        // Delegate to existing AiScoreController logic
        $channels = Channel::where('status', 'active')->get();
        $count = 0;
        foreach ($channels as $channel) {
            $orders = $channel->orders()->count();
            $delivered = $channel->orders()->where('status', 'delivered')->count();
            $cancelled = $channel->orders()->where('status', 'cancel')->count();
            $score = $orders > 0 ? round(($delivered / $orders) * 100, 2) : 0;
            $channel->update(['performance_score' => $score]);
            $count++;
        }
        return ['success' => true, 'channels_scored' => $count];
    }

    private function queryAnalytics(array $input): array
    {
        $type = $input['type'] ?? '';

        return match ($type) {
            'revenue_by_month' => Order::where('status', 'delivered')
                ->selectRaw("DATE_FORMAT(order_date, '%Y-%m') as month, SUM(grand_total) as total")
                ->groupBy('month')->orderBy('month')->limit(12)->get()->toArray(),

            'top_channels' => Channel::where('status', 'active')
                ->orderByDesc('performance_score')
                ->limit((int) ($input['limit'] ?? 10))
                ->get(['channel_code','company_name','performance_score','channel_grade'])
                ->toArray(),

            'order_summary' => [
                'total'     => Order::count(),
                'pending'   => Order::where('status', 'pending')->count(),
                'delivered' => Order::where('status', 'delivered')->count(),
                'cancelled' => Order::where('status', 'cancel')->count(),
            ],

            'inventory_low_stock' => Inventory::whereNotNull('qty')
                ->where('qty', '<', (int) ($input['threshold'] ?? 10))
                ->get(['sku_no','product','qty'])->toArray(),

            default => ['error' => "Unknown analytics type: {$type}"],
        };
    }
}
```

#### 1.4 Create Controller

File: `app/Http/Controllers/AiChatController.php`

```php
<?php

declare(strict_types=1);

namespace App\Http\Controllers;

use App\Models\AiChat;
use App\Services\AiChatService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;

class AiChatController extends Controller
{
    public function chat(Request $request, AiChatService $service): JsonResponse
    {
        $request->validate(['message' => ['required', 'string', 'max:2000']]);

        $result = $service->chat($request->message, Auth::id());

        return response()->json($result);
    }

    public function history(): JsonResponse
    {
        $chats = AiChat::where('user_id', Auth::id())
            ->latest()
            ->limit(50)
            ->get()
            ->reverse()
            ->values();

        return response()->json($chats);
    }

    public function clear(): JsonResponse
    {
        AiChat::where('user_id', Auth::id())->delete();

        return response()->json(['message' => 'Chat history cleared.']);
    }
}
```

#### 1.5 Routes

Add to `routes/web.php` inside `auth` middleware:

```php
use App\Http\Controllers\AiChatController;

// AI Chat (Ollama)
Route::post('/ai/chat', [AiChatController::class, 'chat'])->name('ai.chat');
Route::get('/ai/history', [AiChatController::class, 'history'])->name('ai.history');
Route::delete('/ai/history', [AiChatController::class, 'clear'])->name('ai.clear');
```

---

### STEP 2: Frontend - Chat Widget

#### 2.1 Chat API Hook

File: `resources/js/Hooks/useAiChat.js`

```js
import { useState, useEffect } from 'react';
import axios from 'axios';

export function useAiChat() {
    const [messages, setMessages] = useState([]);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        axios.get('/ai/history').then((res) => {
            const history = [];
            res.data.forEach((chat) => {
                history.push({ role: 'user', content: chat.message });
                history.push({ role: 'assistant', content: chat.response, actions: chat.actions });
            });
            setMessages(history);
        });
    }, []);

    const send = async (message) => {
        setMessages((prev) => [...prev, { role: 'user', content: message }]);
        setLoading(true);

        try {
            const res = await axios.post('/ai/chat', { message });
            setMessages((prev) => [...prev, {
                role: 'assistant',
                content: res.data.response,
                actions: res.data.actions,
            }]);
        } catch (err) {
            setMessages((prev) => [...prev, {
                role: 'assistant',
                content: 'Maaf, terjadi kesalahan. Pastikan Ollama sedang berjalan.',
            }]);
        } finally {
            setLoading(false);
        }
    };

    const clear = async () => {
        await axios.delete('/ai/history');
        setMessages([]);
    };

    return { messages, loading, send, clear };
}
```

#### 2.2 Chat Widget Component

File: `resources/js/Components/AiChat/ChatWidget.jsx`

Floating chat bubble (bottom-right), expands into chat panel.
Navy/gold theme matching CIMS design.

```
+-----------------------------+
| CIMS AI Assistant   [C] [x] |  <- [C] = clear history
|------------------------------|
|                              |
| [AI] Halo! Saya asisten     |
|      CIMS. Ada yang bisa     |
|      saya bantu?             |
|                              |
| [You] Berapa total channel?  |
|                              |
| [AI] Total channel saat ini  |
|      adalah 45 channel,      |
|      38 aktif dan 7 inaktif. |
|      [Action: dashboard_stats]|
|                              |
|------------------------------|
| Type a message...     [Send] |
+-------------------------------+
```

Features:
- Floating gold gradient button (bottom-right corner)
- framer-motion slide-up animation
- Auto-scroll to latest message
- Shows executed actions as small badges
- Loading dots animation while AI thinks
- Clear history button in header
- Open/closed state persisted in localStorage
- Responsive (full-width on mobile)

#### 2.3 Integration in Layout

Add to `AuthenticatedLayout.jsx` after `</main>`:

```jsx
import ChatWidget from '@/Components/AiChat/ChatWidget';

// After </main> closing tag:
<ChatWidget />
```

---

### STEP 3: Execution Checklist

```bash
# 1. Install Ollama (https://ollama.com/download)
#    - Download Windows installer
#    - Run installer
#    - Ollama starts automatically on localhost:11434

# 2. Pull a model
ollama pull qwen2.5:7b

# 3. Add to .env
#    OLLAMA_HOST=http://localhost:11434
#    OLLAMA_MODEL=qwen2.5:7b

# 4. Add ollama config to config/services.php (see Step 0)

# 5. Create migration
php artisan make:migration create_ai_chats_table
# -> copy schema from Step 1.1

# 6. Run migration
php artisan migrate

# 7. Create files:
#    - app/Models/AiChat.php              (Step 1.2)
#    - app/Services/AiChatService.php     (Step 1.3 - FULL code provided)
#    - app/Http/Controllers/AiChatController.php  (Step 1.4)

# 8. Add routes to routes/web.php        (Step 1.5)

# 9. Create frontend files:
#    - resources/js/Hooks/useAiChat.js                (Step 2.1)
#    - resources/js/Components/AiChat/ChatWidget.jsx   (Step 2.2)

# 10. Add <ChatWidget /> to AuthenticatedLayout.jsx  (Step 2.3)

# 11. Build and test
npm run build
php artisan serve

# 12. Test: open CIMS, click the chat bubble, type "Halo"
```

---

### STEP 4: Example Conversations

```
User: "Halo"
AI:   -> action: none
      "Halo! Saya asisten CIMS. Ada yang bisa saya bantu hari ini?"

User: "Berapa revenue bulan ini?"
AI:   -> action: get_dashboard_stats
      "Revenue bulan ini sebesar Rp 45.000.000 dari 12 order yang sudah delivered."

User: "Tampilkan channel grade risk"
AI:   -> action: list_channels {grade: "risk"}
      "Ditemukan 3 channel dengan grade risk:
       1. CH-012 - PT Maju Jaya (score: 15.00)
       2. CH-025 - CV Abadi (score: 20.00)
       3. CH-033 - UD Sejahtera (score: 18.50)"

User: "Update order #5 jadi delivered"
AI:   -> action: update_order_status {id: 5, status: "delivered"}
      "Order ORD-XK8M2NP1 berhasil diubah menjadi delivered."

User: "Cek inventory pompa"
AI:   -> action: list_inventory {search: "pompa"}
      "Ditemukan 2 item:
       1. SKU-045 - Pompa Air 1HP (stok: 25, M1: Rp 350.000)
       2. SKU-046 - Pompa Air 2HP (stok: 12, M1: Rp 650.000)"

User: "Ada cicilan yang telat?"
AI:   -> action: get_overdue_payments
      "Ada 4 cicilan overdue:
       1. Order ORD-ABC - cicilan ke-3, jatuh tempo 2026-04-15, Rp 500.000
       ..."
```

---

### File Summary

| File                                            | Purpose                              |
|-------------------------------------------------|--------------------------------------|
| `.env`                                          | OLLAMA_HOST + OLLAMA_MODEL           |
| `config/services.php`                           | Ollama config                        |
| `database/migrations/*_create_ai_chats_table`   | Chat history table                   |
| `app/Models/AiChat.php`                         | Chat history model                   |
| `app/Services/AiChatService.php`                | Core orchestrator + 16 tool handlers |
| `app/Http/Controllers/AiChatController.php`     | HTTP endpoints (chat/history/clear)  |
| `routes/web.php`                                | 3 new routes (/ai/*)                 |
| `resources/js/Hooks/useAiChat.js`               | React hook for chat API              |
| `resources/js/Components/AiChat/ChatWidget.jsx` | Floating chat UI                     |
| `resources/js/Layouts/AuthenticatedLayout.jsx`  | Add ChatWidget to layout             |

### Notes

- Ollama runs on `localhost:11434` by default, no auth needed
- Response time depends on your GPU/CPU: ~2-5s with GPU, ~10-30s CPU-only
- If using CPU-only, consider `mistral:7b` (faster) over `qwen2.5:14b`
- The 2-phase approach (action selection -> response generation) costs 2 Ollama calls per message
- Chat history is saved per-user in `ai_chats` table
- No data leaves your machine
