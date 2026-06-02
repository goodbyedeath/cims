import { useForm, Link, usePage } from '@inertiajs/react';
import GuestLayout from '@/Layouts/GuestLayout';
import Input from '@/Components/ui/Input';
import Button from '@/Components/ui/Button';
import { ArrowLeft, Mail, Clock } from 'lucide-react';
import { useState, useEffect } from 'react';

const COOLDOWN = 60;
const STORAGE_KEY = 'cims_pw_reset_at';

export default function ForgotPassword() {
    const { flash } = usePage().props;
    const { data, setData, post, processing, errors } = useForm({ email: '' });
    const [cooldown, setCooldown] = useState(0);

    // Restore cooldown from localStorage on mount
    useEffect(() => {
        const saved = localStorage.getItem(STORAGE_KEY);
        if (saved) {
            const elapsed = Math.floor((Date.now() - parseInt(saved)) / 1000);
            const remaining = COOLDOWN - elapsed;
            if (remaining > 0) setCooldown(remaining);
        }
    }, []);

    // Tick countdown
    useEffect(() => {
        if (cooldown <= 0) return;
        const t = setTimeout(() => setCooldown((c) => c - 1), 1000);
        return () => clearTimeout(t);
    }, [cooldown]);

    const submit = (e) => {
        e.preventDefault();
        post('/forgot-password', {
            onSuccess: () => {
                localStorage.setItem(STORAGE_KEY, Date.now().toString());
                setCooldown(COOLDOWN);
            },
        });
    };

    const progress = cooldown > 0 ? ((COOLDOWN - cooldown) / COOLDOWN) * 100 : 0;

    return (
        <GuestLayout>
            <form onSubmit={submit} className="space-y-5">
                <h2 className="text-xl font-bold text-white text-center">Forgot Password</h2>
                <p className="text-sm text-navy-400 text-center">
                    Masukkan email Anda untuk menerima link reset password.
                </p>

                {flash?.success && (
                    <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-lg">
                        <p className="text-sm text-emerald-400">{flash.success}</p>
                    </div>
                )}

                <Input
                    label="Email"
                    type="email"
                    value={data.email}
                    onChange={(e) => setData('email', e.target.value)}
                    error={errors.email}
                    placeholder="your@email.com"
                    autoFocus
                    disabled={cooldown > 0}
                />

                <div className="space-y-2">
                    <Button
                        type="submit"
                        disabled={processing || cooldown > 0}
                        className="w-full"
                    >
                        {cooldown > 0 ? (
                            <>
                                <Clock className="w-4 h-4" />
                                Kirim ulang dalam {cooldown}s
                            </>
                        ) : (
                            <>
                                <Mail className="w-4 h-4" />
                                {processing ? 'Mengirim...' : 'Kirim Link Reset'}
                            </>
                        )}
                    </Button>

                    {/* Progress bar */}
                    {cooldown > 0 && (
                        <div className="w-full h-1 bg-navy-700 rounded-full overflow-hidden">
                            <div
                                className="h-full bg-gold-500 rounded-full transition-all duration-1000 ease-linear"
                                style={{ width: `${progress}%` }}
                            />
                        </div>
                    )}
                </div>

                <div className="text-center">
                    <Link href="/login" className="inline-flex items-center gap-1 text-sm text-navy-400 hover:text-white transition">
                        <ArrowLeft className="w-3 h-3" /> Kembali ke Login
                    </Link>
                </div>
            </form>
        </GuestLayout>
    );
}
