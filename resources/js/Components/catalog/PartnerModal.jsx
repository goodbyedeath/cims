import { useEffect, useRef, useState } from 'react';
import { router } from '@inertiajs/react';
import { KeyRound, X } from 'lucide-react';

/* ─── Partner PIN modal ──────────────────────────────────────────────────── */
export default function PartnerModal({ onClose, error, isDark }) {
    const [digits, setDigits] = useState(['', '', '', '']);
    const [loading, setLoading] = useState(false);
    const [shake, setShake]   = useState(false);
    const refs = [useRef(null), useRef(null), useRef(null), useRef(null)];

    const pin = digits.join('');
    const complete = pin.length === 4;

    useEffect(() => { refs[0].current?.focus(); }, []);

    useEffect(() => {
        if (error) { setShake(true); setDigits(['', '', '', '']); setTimeout(() => { setShake(false); refs[0].current?.focus(); }, 500); }
    }, [error]);

    const submit = (value) => {
        setLoading(true);
        router.post('/catalog/public/verify', { pin: value }, {
            onFinish: () => setLoading(false),
            onSuccess: onClose,
            preserveScroll: true,
        });
    };

    const handleChange = (i, val) => {
        const digit = val.replace(/\D/g, '').slice(-1);
        const next = [...digits];
        next[i] = digit;
        setDigits(next);
        if (digit && i < 3) refs[i + 1].current?.focus();
        if (digit && i === 3) {
            const full = next.join('');
            if (full.length === 4) submit(full);
        }
    };

    const handleKeyDown = (i, e) => {
        if (e.key === 'Backspace') {
            if (digits[i]) {
                const next = [...digits]; next[i] = ''; setDigits(next);
            } else if (i > 0) {
                refs[i - 1].current?.focus();
            }
        } else if (e.key === 'ArrowLeft' && i > 0) {
            refs[i - 1].current?.focus();
        } else if (e.key === 'ArrowRight' && i < 3) {
            refs[i + 1].current?.focus();
        } else if (e.key === 'Enter' && complete) {
            submit(pin);
        }
    };

    const handlePaste = (e) => {
        e.preventDefault();
        const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 4);
        if (!pasted) return;
        const next = ['', '', '', ''];
        pasted.split('').forEach((d, i) => { next[i] = d; });
        setDigits(next);
        const focusIdx = Math.min(pasted.length, 3);
        refs[focusIdx].current?.focus();
        if (pasted.length === 4) submit(pasted);
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ animation: 'fadeIn 0.2s ease' }} onClick={onClose}>
            <div className="absolute inset-0 bg-black/70 backdrop-blur-md" />
            <div
                className={`relative z-10 w-full max-w-xs rounded-3xl shadow-2xl overflow-hidden ${isDark ? 'bg-navy-900 border border-white/10' : 'bg-white border border-gray-200 shadow-xl'}`}
                style={{ animation: 'slideUp 0.25s cubic-bezier(0.34,1.4,0.64,1)' }}
                onClick={(e) => e.stopPropagation()}
            >
                <div className="h-1 w-full bg-gradient-to-r from-gold-600 via-gold-400 to-gold-600" />
                <div className="p-6">
                    {/* Header */}
                    <div className="flex items-start justify-between gap-3 mb-6">
                        <div className="flex items-center gap-3">
                            <div className={`w-11 h-11 rounded-2xl flex items-center justify-center shrink-0 ${isDark ? 'bg-gold-500/10 border border-gold-500/25' : 'bg-amber-50 border border-amber-200'}`}>
                                <KeyRound className={`w-5 h-5 ${isDark ? 'text-gold-400' : 'text-amber-600'}`} />
                            </div>
                            <div>
                                <h2 className={`text-base font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>Akses Partner</h2>
                                <p className={`text-xs mt-0.5 ${isDark ? 'text-navy-500' : 'text-gray-400'}`}>Masukkan 4-digit kode akses</p>
                            </div>
                        </div>
                        <button onClick={onClose} className={`w-8 h-8 rounded-full flex items-center justify-center transition shrink-0 ${isDark ? 'text-navy-500 hover:text-white hover:bg-white/8' : 'text-gray-400 hover:text-gray-700 hover:bg-gray-100'}`}>
                            <X className="w-4 h-4" />
                        </button>
                    </div>

                    {/* Error */}
                    {error && (
                        <div className="mb-5 flex items-center gap-2 px-3.5 py-2.5 rounded-xl bg-red-500/10 border border-red-500/20 text-xs text-red-400">
                            <X className="w-3.5 h-3.5 shrink-0" />{error}
                        </div>
                    )}

                    {/* OTP boxes */}
                    <div className={`flex justify-center gap-3 mb-6 ${shake ? 'animate-[shake_0.45s_ease]' : ''}`}>
                        {digits.map((d, i) => (
                            <input
                                key={i}
                                ref={refs[i]}
                                type="text"
                                inputMode="numeric"
                                maxLength={1}
                                value={d}
                                onChange={(e) => handleChange(i, e.target.value)}
                                onKeyDown={(e) => handleKeyDown(i, e)}
                                onPaste={handlePaste}
                                onFocus={(e) => e.target.select()}
                                className={`w-14 h-16 rounded-2xl text-center text-2xl font-black border-2 focus:outline-none transition-all duration-150 select-none ${
                                    d
                                        ? isDark
                                            ? 'bg-gold-500/10 border-gold-500 text-gold-400 shadow-lg shadow-gold-500/15'
                                            : 'bg-amber-50 border-amber-400 text-amber-700 shadow-lg shadow-amber-500/15'
                                        : isDark
                                            ? 'bg-navy-800/60 border-white/10 text-white focus:border-gold-500/60 focus:bg-navy-800'
                                            : 'bg-gray-50 border-gray-200 text-gray-900 focus:border-amber-400 focus:bg-white'
                                }`}
                            />
                        ))}
                    </div>

                    {/* Submit */}
                    <button
                        onClick={() => complete && !loading && submit(pin)}
                        disabled={!complete || loading}
                        className="w-full px-4 py-3 rounded-xl bg-gold-500 text-navy-950 text-sm font-bold hover:bg-gold-400 transition disabled:opacity-35 disabled:cursor-not-allowed"
                    >
                        {loading ? (
                            <span className="flex items-center justify-center gap-2">
                                <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/></svg>
                                Memverifikasi…
                            </span>
                        ) : 'Masuk sebagai Partner'}
                    </button>

                    <p className={`mt-4 text-center text-[10px] ${isDark ? 'text-navy-700' : 'text-gray-300'}`}>Kode diberikan oleh sales representative Anda.</p>
                </div>
            </div>
        </div>
    );
}

