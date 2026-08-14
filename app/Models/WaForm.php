<?php

declare(strict_types=1);

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class WaForm extends Model
{
    protected $fillable = [
        'user_id',
        'title',
        'type',
        'header',
        'body',
        'footer',
        'button_label',
        'items',
        'config',
        'is_active',
    ];

    protected function casts(): array
    {
        return [
            'items'     => 'array',
            'config'    => 'array',
            'is_active' => 'boolean',
        ];
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function rules(): HasMany
    {
        return $this->hasMany(WaBotRule::class);
    }

    public function cfg(string $key, mixed $default = null): mixed
    {
        return data_get($this->config, $key, $default);
    }

    /**
     * Build the WhatsApp Cloud-API "interactive" object for this form. Gateways
     * (Wablas et al.) proxy this shape. Returns null for types that have no
     * interactive representation.
     *
     * @return array<string,mixed>|null
     */
    public function toInteractivePayload(): ?array
    {
        $header = $this->header ? ['type' => 'text', 'text' => $this->header] : null;
        $body   = ['text' => $this->body];
        $footer = $this->footer ? ['text' => $this->footer] : null;

        $base = array_filter([
            'header' => $header,
            'body'   => $body,
            'footer' => $footer,
        ], fn ($v) => $v !== null);

        return match ($this->type) {
            'button' => $base + [
                'type'   => 'button',
                'action' => [
                    'buttons' => array_map(
                        fn ($b, $i) => [
                            'type'  => 'reply',
                            'reply' => ['id' => $b['id'] ?? (string) ($i + 1), 'title' => $b['text'] ?? ''],
                        ],
                        $this->items ?? [],
                        array_keys($this->items ?? []),
                    ),
                ],
            ],

            'list' => $base + [
                'type'   => 'list',
                'action' => [
                    'button'   => $this->button_label ?: 'Pilih',
                    'sections' => array_map(fn ($s) => [
                        'title' => $s['title'] ?? '',
                        'rows'  => array_map(fn ($r, $i) => array_filter([
                            'id'          => $r['id'] ?? (string) ($i + 1),
                            'title'       => $r['title'] ?? '',
                            'description' => $r['description'] ?? null,
                        ], fn ($v) => $v !== null && $v !== ''), $s['rows'] ?? [], array_keys($s['rows'] ?? [])),
                    ], $this->items ?? []),
                ],
            ],

            'product' => array_filter(['body' => $body, 'footer' => $footer], fn ($v) => $v !== null) + [
                'type'   => 'product',
                'action' => [
                    'catalog_id'          => (string) $this->cfg('catalog_id'),
                    'product_retailer_id' => (string) $this->cfg('product_retailer_id'),
                ],
            ],

            'product_list' => $base + [
                'type'   => 'product_list',
                'action' => [
                    'catalog_id' => (string) $this->cfg('catalog_id'),
                    'sections'   => array_map(fn ($s) => [
                        'title'         => $s['title'] ?? '',
                        'product_items' => array_map(
                            fn ($p) => ['product_retailer_id' => (string) ($p['product_retailer_id'] ?? '')],
                            $s['products'] ?? [],
                        ),
                    ], $this->items ?? []),
                ],
            ],

            'flow' => $base + [
                'type'   => 'flow',
                'action' => [
                    'name'       => 'flow',
                    'parameters' => array_filter([
                        'flow_message_version' => '3',
                        'flow_token'           => $this->cfg('flow_token', 'cims-'.$this->id),
                        'flow_id'              => (string) $this->cfg('flow_id'),
                        'flow_cta'             => $this->cfg('flow_cta', 'Buka'),
                        'flow_action'          => $this->cfg('flow_action', 'navigate'),
                        'flow_action_payload'  => $this->cfg('flow_screen')
                            ? ['screen' => $this->cfg('flow_screen')]
                            : null,
                    ], fn ($v) => $v !== null),
                ],
            ],

            default => null,
        };
    }

    /**
     * Plain-text fallback used when the gateway can't deliver native
     * interactive messages. Works on every WhatsApp account.
     */
    public function toTextMenu(): string
    {
        $lines = [];

        if ($this->header) {
            $lines[] = "*{$this->header}*";
            $lines[] = '';
        }

        if ($this->body) {
            $lines[] = $this->body;
            $lines[] = '';
        }

        $n = 1;
        switch ($this->type) {
            case 'button':
                foreach ($this->items ?? [] as $btn) {
                    $lines[] = $n.'. '.($btn['text'] ?? '');
                    $n++;
                }
                $lines[] = '';
                $lines[] = '_Balas dengan angka pilihan Anda._';
                break;

            case 'list':
                foreach ($this->items ?? [] as $section) {
                    if (! empty($section['title'])) {
                        $lines[] = "— {$section['title']} —";
                    }
                    foreach ($section['rows'] ?? [] as $row) {
                        $desc = ! empty($row['description']) ? " ({$row['description']})" : '';
                        $lines[] = $n.'. '.($row['title'] ?? '').$desc;
                        $n++;
                    }
                }
                $lines[] = '';
                $lines[] = '_Balas dengan angka pilihan Anda._';
                break;

            case 'product':
                $lines[] = '🛍️ Kode produk: '.$this->cfg('product_retailer_id');
                $lines[] = 'Lihat katalog lengkap: '.rtrim((string) config('app.url'), '/').'/catalog/public';
                break;

            case 'product_list':
                foreach ($this->items ?? [] as $section) {
                    if (! empty($section['title'])) {
                        $lines[] = "— {$section['title']} —";
                    }
                    foreach ($section['products'] ?? [] as $p) {
                        $lines[] = '• '.($p['product_retailer_id'] ?? '');
                    }
                }
                $lines[] = '';
                $lines[] = 'Katalog: '.rtrim((string) config('app.url'), '/').'/catalog/public';
                break;

            case 'flow':
                $lines[] = '📋 '.$this->cfg('flow_cta', 'Buka formulir');
                $lines[] = '_(Formulir interaktif — buka di aplikasi WhatsApp terbaru.)_';
                break;
        }

        if ($this->footer) {
            $lines[] = '';
            $lines[] = $this->footer;
        }

        return trim(implode("\n", $lines));
    }
}
