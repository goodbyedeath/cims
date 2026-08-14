<?php

declare(strict_types=1);

namespace Tests\Feature;

use App\Models\WaBotRule;
use App\Models\WaInboundMessage;
use App\Services\WhatsAppService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class WaBotTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        // This app ships MySQL-only migrations (ENUM MODIFY, FULLTEXT indexes)
        // that the in-memory sqlite test DB can't build, and RefreshDatabase
        // migrates during parent::setUp() — so skip BEFORE booting. These run
        // under a MySQL connection in CI.
        $driver = getenv('DB_CONNECTION') ?: ($_ENV['DB_CONNECTION'] ?? 'sqlite');
        if ($driver === 'sqlite') {
            $this->markTestSkipped('Schema requires MySQL; sqlite cannot run this app\'s migrations.');
        }

        parent::setUp();
    }

    /** A WhatsAppService that records calls instead of hitting Wablas. */
    private function fakeGateway(): WhatsAppService
    {
        return new class extends WhatsAppService {
            public array $log = [];
            public function send(string $phone, string $message): array
            {
                $this->log[] = ['text', $phone, $message];
                return ['success' => true];
            }
        };
    }

    public function test_webhook_rejects_wrong_secret(): void
    {
        config(['services.wablas.secret' => 'rightsecret']);

        $this->postJson('/wa/webhook/wrongsecret', ['phone' => '628123', 'message' => 'halo'])
            ->assertStatus(403);

        $this->assertSame(0, WaInboundMessage::count());
    }

    public function test_webhook_logs_and_auto_replies_on_match(): void
    {
        config(['services.wablas.secret' => 'rightsecret']);
        $fake = $this->fakeGateway();
        $this->app->instance(WhatsAppService::class, $fake);

        WaBotRule::create([
            'name' => 'Harga', 'match_type' => 'contains', 'keyword' => 'harga',
            'reply_type' => 'text', 'reply_message' => 'Cek katalog kami.',
            'priority' => 5, 'is_active' => true,
        ]);

        $this->postJson('/wa/webhook/rightsecret', ['phone' => '628123', 'message' => 'berapa HARGA?'])
            ->assertOk()->assertJson(['ok' => true]);

        $inbound = WaInboundMessage::first();
        $this->assertNotNull($inbound);
        $this->assertTrue($inbound->reply_sent);
        $this->assertSame('Cek katalog kami.', $inbound->reply_text);
        $this->assertCount(1, $fake->log);
        $this->assertSame(1, WaBotRule::first()->hit_count);
    }

    public function test_webhook_extracts_button_reply_and_matches_rule(): void
    {
        config(['services.wablas.secret' => 'rightsecret']);
        $fake = $this->fakeGateway();
        $this->app->instance(WhatsAppService::class, $fake);

        WaBotRule::create([
            'name' => 'Katalog', 'match_type' => 'exact', 'keyword' => 'Katalog',
            'reply_type' => 'text', 'reply_message' => 'Ini katalog kami.',
            'priority' => 5, 'is_active' => true,
        ]);

        // No plain text — only an interactive button tap.
        $this->postJson('/wa/webhook/rightsecret', [
            'phone' => '628123',
            'interactive' => ['button_reply' => ['id' => 'katalog', 'title' => 'Katalog']],
        ])->assertOk();

        $inbound = WaInboundMessage::first();
        $this->assertSame('Katalog', $inbound->message);
        $this->assertTrue($inbound->reply_sent);
        $this->assertCount(1, $fake->log);
    }

    public function test_webhook_stays_silent_when_no_rule_matches(): void
    {
        config(['services.wablas.secret' => 'rightsecret']);
        $fake = $this->fakeGateway();
        $this->app->instance(WhatsAppService::class, $fake);

        $this->postJson('/wa/webhook/rightsecret', ['phone' => '628123', 'message' => 'random'])
            ->assertOk();

        $inbound = WaInboundMessage::first();
        $this->assertNotNull($inbound);
        $this->assertFalse($inbound->reply_sent);
        $this->assertNull($inbound->matched_rule_id);
        $this->assertCount(0, $fake->log);
    }
}
