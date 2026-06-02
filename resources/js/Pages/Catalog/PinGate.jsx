import { useForm } from '@inertiajs/react';
import { Head } from '@inertiajs/react';
import { Lock, ShoppingBag, Eye, EyeOff } from 'lucide-react';
import { useState } from 'react';

export default function PinGate({ error }) {
    const { data, setData, post, processing } = useForm({ pin: '' });
    const [showPin, setShowPin] = useState(false);

    const submit = (e) => {
        e.preventDefault();
        post('/catalog/public/verify', { preserveScroll: true });
    };

    return (
        <>
            <Head title="Product Catalog — Access Required" />
            <style>{`
                @keyframes fadeUp  { from { opacity:0; transform:translateY(20px) } to { opacity:1; transform:translateY(0) } }
                /* GPU-composited pulse: scale+opacity only — no box-shadow paint */
                @keyframes pulse   { 0%,100% { transform:scale(1); opacity:1 } 50% { transform:scale(1.06); opacity:.88 } }
            `}</style>

            <div className="min-h-screen bg-navy-950 flex items-center justify-center p-4 relative overflow-hidden">
                <div className="w-full max-w-sm relative" style={{ animation: 'fadeUp 0.35s ease both' }}>
                    {/* Logo mark */}
                    <div className="flex flex-col items-center mb-8">
                        <div
                            className="w-20 h-20 rounded-3xl bg-gradient-to-br from-gold-400 to-gold-600 flex items-center justify-center mb-5 shadow-xl shadow-gold-500/25"
                            style={{ animation: 'pulse 3s ease-in-out infinite' }}
                        >
                            <ShoppingBag className="w-9 h-9 text-navy-950" />
                        </div>
                        <h1 className="text-2xl font-black text-white tracking-tight">Product Catalog</h1>
                        <p className="text-sm text-navy-400 mt-1.5 text-center max-w-xs">
                            This catalog is access-protected. Enter your code to continue.
                        </p>
                    </div>

                    {/* Card */}
                    <div className="bg-navy-900 border border-white/8 rounded-2xl p-6 shadow-2xl">
                        <form onSubmit={submit} className="space-y-4">
                            <div>
                                <label className="block text-xs font-semibold uppercase tracking-wider text-navy-400 mb-2">
                                    Access Code
                                </label>
                                <div className="relative">
                                    <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-navy-500 pointer-events-none" />
                                    <input
                                        type={showPin ? 'text' : 'password'}
                                        value={data.pin}
                                        onChange={(e) => setData('pin', e.target.value)}
                                        placeholder="Enter access code"
                                        autoFocus
                                        autoComplete="off"
                                        className={`w-full pl-10 pr-12 py-3 bg-navy-800/60 border rounded-xl text-white text-sm placeholder-navy-600 focus:outline-none focus:ring-2 transition ${
                                            error
                                                ? 'border-red-500/50 focus:ring-red-500/20 focus:border-red-500/50'
                                                : 'border-white/10 focus:ring-gold-500/30 focus:border-gold-500/30'
                                        }`}
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setShowPin((v) => !v)}
                                        className="absolute right-3.5 top-1/2 -translate-y-1/2 p-1 text-navy-500 hover:text-navy-300 transition"
                                        tabIndex={-1}
                                    >
                                        {showPin ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                    </button>
                                </div>

                                {error && (
                                    <div className="mt-2 flex items-center gap-1.5 text-xs text-red-400">
                                        <div className="w-1 h-1 rounded-full bg-red-400 shrink-0" />
                                        {error}
                                    </div>
                                )}
                            </div>

                            <button
                                type="submit"
                                disabled={processing || !data.pin}
                                className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-gold-500 to-gold-400 hover:from-gold-400 hover:to-gold-300 disabled:opacity-40 disabled:cursor-not-allowed text-navy-950 font-bold text-sm transition-all shadow-lg shadow-gold-500/20 hover:shadow-gold-500/30"
                            >
                                {processing ? (
                                    <span className="flex items-center justify-center gap-2">
                                        <span className="w-3.5 h-3.5 border-2 border-navy-950/30 border-t-navy-950 rounded-full animate-spin" />
                                        Verifying…
                                    </span>
                                ) : 'View Catalog'}
                            </button>
                        </form>
                    </div>

                    <p className="text-center text-xs text-navy-600 mt-5">
                        Don't have a code? Contact your sales representative.
                    </p>
                </div>
            </div>
        </>
    );
}
