<?php

declare(strict_types=1);

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class OfferingRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    /**
     * @return array<string, mixed>
     */
    public function rules(): array
    {
        return [
            'channel_id'           => ['required', 'exists:channels,id'],
            'offering_date'        => ['required', 'date'],
            'valid_until'          => ['nullable', 'date'],
            'discount'             => ['nullable', 'numeric', 'min:0'],
            'tax_rate'             => ['nullable', 'numeric', 'min:0', 'max:100'],
            'note'                 => ['nullable', 'string'],
            'items'                => ['required', 'array', 'min:1'],
            'items.*.inventory_id' => ['required', 'exists:inventories,id'],
            'items.*.qty'          => ['required', 'integer', 'min:1'],
            'items.*.price'        => ['required', 'numeric', 'min:0'],
        ];
    }
}
