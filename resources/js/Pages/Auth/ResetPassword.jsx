import { useForm, Link } from '@inertiajs/react';
import GuestLayout from '@/Layouts/GuestLayout';
import Input from '@/Components/ui/Input';
import Button from '@/Components/ui/Button';
import { ArrowLeft, KeyRound } from 'lucide-react';

export default function ResetPassword({ token, email }) {
    const { data, setData, post, processing, errors } = useForm({
        token,
        email,
        password: '',
        password_confirmation: '',
    });

    const submit = (e) => {
        e.preventDefault();
        post('/reset-password');
    };

    return (
        <GuestLayout>
            <form onSubmit={submit} className="space-y-5">
                <h2 className="text-xl font-bold text-white text-center">Reset Password</h2>
                <p className="text-sm text-navy-400 text-center">Masukkan password baru Anda.</p>

                {errors.token && (
                    <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg">
                        <p className="text-sm text-red-400">{errors.token}</p>
                    </div>
                )}

                <Input
                    label="Email"
                    type="email"
                    value={data.email}
                    onChange={(e) => setData('email', e.target.value)}
                    error={errors.email}
                    disabled
                />

                <Input
                    label="Password Baru"
                    type="password"
                    peek
                    value={data.password}
                    onChange={(e) => setData('password', e.target.value)}
                    error={errors.password}
                    placeholder="Minimal 6 karakter"
                    autoFocus
                />

                <Input
                    label="Konfirmasi Password"
                    type="password"
                    peek
                    value={data.password_confirmation}
                    onChange={(e) => setData('password_confirmation', e.target.value)}
                    error={errors.password_confirmation}
                    placeholder="Ulangi password"
                />

                <Button type="submit" disabled={processing} className="w-full">
                    <KeyRound className="w-4 h-4" />
                    {processing ? 'Resetting...' : 'Reset Password'}
                </Button>

                <div className="text-center">
                    <Link href="/login" className="inline-flex items-center gap-1 text-sm text-navy-400 hover:text-white transition">
                        <ArrowLeft className="w-3 h-3" /> Kembali ke Login
                    </Link>
                </div>
            </form>
        </GuestLayout>
    );
}
