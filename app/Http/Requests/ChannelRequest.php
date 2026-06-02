<?php

declare(strict_types=1);

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class ChannelRequest extends FormRequest
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
        $channelId = $this->route('channel')?->id;

        return [
            'channel_code' => [
                'required',
                'string',
                'max:20',
                Rule::unique('channels', 'channel_code')->ignore($channelId),
            ],
            'company_name' => ['required', 'string', 'max:255'],
            'owner_name' => ['required', 'string', 'max:255'],
            'gender' => ['nullable', 'in:male,female'],
            'purchasing_staff' => ['nullable', 'string', 'max:255'],
            'phone' => ['nullable', 'string', 'max:20'],
            'email' => ['nullable', 'email', 'max:255'],
            'address' => ['required', 'string'],
            'province' => ['required', 'string', 'max:255'],
            'city' => ['required', 'string', 'max:255'],
            'district' => ['nullable', 'string', 'max:255'],
            'latitude' => ['nullable', 'numeric', 'between:-90,90'],
            'longitude' => ['nullable', 'numeric', 'between:-180,180'],
            'assigned_user_id' => ['nullable', 'exists:users,id'],
            'status'           => ['required', 'in:active,inactive,blacklist'],
            'blacklist_reason'  => ['nullable', 'string', 'required_if:status,blacklist'],
        ];
    }
}
