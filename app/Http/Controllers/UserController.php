<?php

declare(strict_types=1);

namespace App\Http\Controllers;

use App\Models\User;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Validation\Rule;
use Inertia\Inertia;
use Inertia\Response;

class UserController extends Controller
{
    public function index(Request $request): Response
    {
        $filters = $request->only(['search', 'role', 'sort_by', 'sort_dir']);

        $sortable = ['name', 'email', 'role', 'created_at'];
        $sortBy   = in_array($filters['sort_by'] ?? '', $sortable, true) ? $filters['sort_by'] : 'created_at';
        $sortDir  = ($filters['sort_dir'] ?? 'desc') === 'asc' ? 'asc' : 'desc';

        $users = User::with('supervisor:id,name')
            ->when($filters['search'] ?? null, function ($q, $search) {
                $q->where(function ($query) use ($search) {
                    $query->where('name', 'like', "%{$search}%")
                        ->orWhere('email', 'like', "%{$search}%");
                });
            })
            ->when($filters['role'] ?? null, fn ($q, $role) => $q->where('role', $role))
            ->orderBy($sortBy, $sortDir)
            ->paginate(15)
            ->withQueryString();

        $supervisors = User::where('role', 'spv')
            ->where('status', 'active')
            ->get(['id', 'name']);

        return Inertia::render('Users/Index', [
            'users' => $users,
            'filters' => $filters,
            'supervisors' => $supervisors,
        ]);
    }

    public function store(Request $request): RedirectResponse
    {
        $validated = $request->validate([
            'name' => ['required', 'string', 'max:255'],
            'email' => ['required', 'email', 'unique:users,email'],
            'phone' => ['nullable', 'string', 'max:20'],
            'password' => ['required', 'string', 'min:6'],
            'role' => ['required', 'in:admin,spv,downline'],
            'spv_id' => ['nullable', 'exists:users,id'],
            'status' => ['sometimes', 'in:active,inactive'],
        ]);

        $validated['password'] = Hash::make($validated['password']);

        User::create($validated);

        return back()->with('success', 'User created successfully.');
    }

    public function update(Request $request, User $user): RedirectResponse
    {
        $validated = $request->validate([
            'name' => ['required', 'string', 'max:255'],
            'email' => ['required', 'email', Rule::unique('users')->ignore($user->id)],
            'phone' => ['nullable', 'string', 'max:20'],
            'password' => ['nullable', 'string', 'min:6'],
            'role' => ['required', 'in:admin,spv,downline'],
            'spv_id' => ['nullable', 'exists:users,id'],
            'status' => ['sometimes', 'in:active,inactive'],
        ]);

        if (!empty($validated['password'])) {
            $validated['password'] = Hash::make($validated['password']);
        } else {
            unset($validated['password']);
        }

        $user->update($validated);

        return back()->with('success', 'User updated successfully.');
    }

    public function destroy(User $user): RedirectResponse
    {
        $user->delete();

        return back()->with('success', 'User deleted successfully.');
    }
}
