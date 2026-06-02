<?php

declare(strict_types=1);

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class OrderRequest extends FormRequest
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
            'channel_id' => ['required', 'exists:channels,id'],
            'order_date' => ['required', 'date'],
            'delivery_date' => ['nullable', 'date'],
            'payment_method' => ['required', 'in:cash,transfer,credit'],
            'discount' => ['nullable', 'numeric', 'min:0'],
            'tax_rate' => ['nullable', 'numeric', 'min:0', 'max:100'],
            'note' => ['nullable', 'string'],
            'payment_type' => ['required', 'in:cash,installment'],
            'dp' => ['nullable', 'numeric', 'min:0'],
            'installment_count' => ['nullable', 'integer', 'min:0', 'max:24', 'required_if:payment_type,installment'],
            'items' => ['required', 'array', 'min:1'],
            'items.*.inventory_id' => ['required', 'exists:inventories,id'],
            'items.*.qty' => ['required', 'integer', 'min:1'],
            'items.*.price' => ['required', 'numeric', 'min:0'],
        ];
    }
}
