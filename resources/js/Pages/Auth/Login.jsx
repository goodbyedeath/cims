import { useForm, Link, usePage } from '@inertiajs/react';
import GuestLayout from '@/Layouts/GuestLayout';
import Input from '@/Components/ui/Input';
import Button from '@/Components/ui/Button';
import { ShieldAlert, Clock } from 'lucide-react';
import { useState, useEffect } from 'react';

export default function Login() {
    const { flash } = usePage().props;
    const { data, setData, post, processing, errors } = useForm({
        email: '',
        password: '',
        remember: false,
    });

    const [lockout, setLockout] = useState(flash?.lockout_seconds || 0);

    // Sync lockout from server response (redirect back with flash)
    useEffect(() => {
        if (flash?.lockout_seconds > 0) setLockout(flash.lockout_seconds);
    }, [flash?.lockout_seconds]);

    // Countdown tick
    useEffect(() => {
        if (lockout <= 0) return;
        const t = setTimeout(() => setLockout((c) => c - 1), 1000);
        return () => clearTimeout(t);
    }, [lockout]);

    const submit = (e) => {
        e.preventDefault();
        if (lockout > 0) return;
        post('/login');
    };

    const isLocked = lockout > 0;
    const lockoutMins = Math.ceil(lockout / 60);

    return (
        <GuestLayout>
            <form onSubmit={submit} className="space-y-5">
                <h2 className="text-xl font-bold text-white text-center">Sign In</h2>

                {flash?.success && (
                    <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-lg">
                        <p className="text-sm text-emerald-400">{flash.success}</p>
                    </div>
                )}

                {/* Lockout banner */}
                {isLocked && (
                    <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg flex items-start gap-2.5">
                        <ShieldAlert className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
                        <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-red-400">Akun Sementara Dikunci</p>
                            <p className="text-xs text-red-400/80 mt-0.5">
                                Terlalu banyak percobaan gagal. Coba lagi dalam{' '}
                                <span className="font-bold tabular-nums">{lockout}s</span>
                                {lockoutMins > 1 && ` (±${lockoutMins} menit)`}.
                            </p>
                            {/* Progress bar draining */}
                            <div className="mt-2 w-full h-1 bg-red-500/20 rounded-full overflow-hidden">
                                <div
                                    className="h-full bg-red-500 rounded-full transition-all duration-1000 ease-linear"
                                    style={{ width: `${(lockout / (flash?.lockout_seconds || 900)) * 100}%` }}
                                />
                            </div>
                        </div>
                    </div>
                )}

                <Input
                    label="Email"
                    type="email"
                    value={data.email}
                    onChange={(e) => setData('email', e.target.value)}
                    error={!isLocked ? errors.email : undefined}
                    placeholder="Email here"
                    autoFocus
                    disabled={isLocked}
                />

                <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                        <label className="block text-sm font-medium text-navy-200">Password</label>
                    </div>
                    <Input
                        type="password"
                        peek
                        value={data.password}
                        onChange={(e) => setData('password', e.target.value)}
                        error={errors.password}
                        placeholder="Password here"
                        disabled={isLocked}
                    />
                    {!isLocked && errors.email && (
                        <p className="text-xs text-red-400">{errors.email}</p>
                    )}
                </div>

                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <input
                            type="checkbox"
                            id="remember"
                            checked={data.remember}
                            onChange={(e) => setData('remember', e.target.checked)}
                            disabled={isLocked}
                            className="w-4 h-4 rounded border-white/10 bg-navy-800 text-gold-500 focus:ring-gold-500/30"
                        />
                        <label htmlFor="remember" className="text-sm text-navy-300">Remember me</label>
                    </div>
                    <Link href="/forgot-password" className="text-sm text-gold-400 hover:text-gold-300 transition">
                        Forgot password?
                    </Link>
                </div>

                <Button type="submit" disabled={processing || isLocked} className="w-full">
                    {isLocked ? (
                        <>
                            <Clock className="w-4 h-4" />
                            Dikunci — {lockout}s
                        </>
                    ) : processing ? 'Signing in...' : 'Sign In'}
                </Button>
            </form>
        </GuestLayout>
    );
}
