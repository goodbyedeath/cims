import { useEffect, useState } from 'react';
import {
    UserPlus, X, MapPin, Loader2, MessageCircle, CheckCircle2, Sparkles,
} from 'lucide-react';
import { csrfHeaders } from '@/Lib/utils';

/* ─── Channel registration modal ─────────────────────────────────────────── */
// Same "Alamat, Kecamatan, Kota, Provinsi" parse + Nominatim geocode used by
// the internal channel form (Channels/Form.jsx), so registrations land with
// identical address structure and coordinates.
function parseFullAddress(text) {
    const parts = text.split(',').map((s) => s.trim()).filter(Boolean);
    // Tolerate common tails: a trailing "Indonesia" or a standalone postcode
    // segment, and a postcode appended to the province ("DKI Jakarta 12190").
    while (parts.length && (/^indonesia$/i.test(parts[parts.length - 1]) || /^\d{4,6}$/.test(parts[parts.length - 1]))) {
        parts.pop();
    }
    if (parts.length) parts[parts.length - 1] = parts[parts.length - 1].replace(/\s+\d{4,6}$/, '').trim();
    const clean = parts.filter(Boolean);
    // Minimum is Alamat, Kota, Provinsi — Kecamatan (district) is optional.
    if (clean.length < 3) return null;

    const province = clean[clean.length - 1];
    const city = clean[clean.length - 2];
    const district = clean.length >= 4 ? clean[clean.length - 3] : '';
    const addrEnd = clean.length >= 4 ? clean.length - 3 : clean.length - 2;
    const address = clean.slice(0, addrEnd).join(', ') || clean[0];

    return { address, district, city, province };
}

export default function RegisterModal({ onClose, isDark, initialMode = 'register' }) {
    // 'register' = new channel signup; 'login' = returning registered channel
    // re-unlocking the special price with a WhatsApp OTP only.
    const [mode, setMode] = useState(initialMode);
    const [step, setStep] = useState('form'); // form → otp → done
    const [form, setForm] = useState({ owner_name: '', company_name: '', phone: '', email: '', fullAddress: '' });
    const [coords, setCoords] = useState({ latitude: null, longitude: null });
    const [geoState, setGeoState] = useState({ busy: false, note: '' });
    const [otp, setOtp] = useState('');
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');
    const [cooldown, setCooldown] = useState(0);
    const [doneMessage, setDoneMessage] = useState('');

    const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));
    const parsed = parseFullAddress(form.fullAddress);

    useEffect(() => {
        if (cooldown <= 0) return undefined;
        const t = setInterval(() => setCooldown((c) => c - 1), 1000);
        return () => clearInterval(t);
    }, [cooldown > 0]);

    const csrf = typeof document !== 'undefined'
        ? document.querySelector('meta[name="csrf-token"]')?.getAttribute('content') || ''
        : '';

    const postJson = async (url, body) => {
        const res = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', ...csrfHeaders(), Accept: 'application/json' },
            body: JSON.stringify(body),
        });
        const json = await res.json().catch(() => ({}));
        const firstError = json.errors ? Object.values(json.errors)[0]?.[0] : null;
        return { ok: res.ok && json.ok !== false, message: firstError || json.message || 'Terjadi kesalahan. Coba lagi.' };
    };

    // Same lookup strategy as the internal form: city-level first, then district.
    const findLocation = async () => {
        if (!parsed) { setGeoState({ busy: false, note: 'Format: Alamat, Kecamatan, Kota, Provinsi' }); return; }
        setGeoState({ busy: true, note: '' });
        try {
            const queries = [
                [parsed.city, parsed.province, 'Indonesia'].filter(Boolean).join(', '),
                [parsed.district, parsed.city, parsed.province, 'Indonesia'].filter(Boolean).join(', '),
            ];
            let results = [];
            for (const q of queries) {
                const res = await fetch(`https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(q)}&format=json&limit=1`, {
                    headers: { 'Accept-Language': 'id' },
                });
                results = await res.json();
                if (results.length > 0) break;
            }
            if (results.length > 0) {
                setCoords({ latitude: results[0].lat, longitude: results[0].lon });
                setGeoState({ busy: false, note: '✓ Lokasi ditemukan' });
            } else {
                setCoords({ latitude: null, longitude: null });
                setGeoState({ busy: false, note: 'Koordinat tidak ditemukan — alamat tetap dipakai.' });
            }
        } catch {
            setGeoState({ busy: false, note: 'Gagal mencari koordinat — alamat tetap dipakai.' });
        }
    };

    const formValid = form.owner_name.trim() && form.company_name.trim() && form.phone.trim()
        && /^\S+@\S+\.\S+$/.test(form.email) && parsed?.city && parsed?.province;

    const sendOtp = async () => {
        if (mode === 'login') {
            if (!form.phone.trim()) { setError('Masukkan nomor WhatsApp yang terdaftar.'); return; }
        } else if (!formValid) {
            setError(!parsed?.city || !parsed?.province
                ? 'Lengkapi alamat dengan format: Alamat, Kota, Provinsi (Kecamatan opsional).'
                : 'Lengkapi semua data terlebih dahulu.');
            return;
        }
        setBusy(true); setError('');
        const url = mode === 'login' ? '/catalog/public/login/otp' : '/catalog/public/register/otp';
        const res = await postJson(url, { phone: form.phone });
        setBusy(false);
        if (res.ok) { setStep('otp'); setOtp(''); setCooldown(60); }
        else setError(res.message);
    };

    const submit = async () => {
        if (otp.length !== 6) { setError('Masukkan 6 digit kode dari WhatsApp.'); return; }
        setBusy(true); setError('');
        const res = mode === 'login'
            ? await postJson('/catalog/public/login', { phone: form.phone, otp })
            : await postJson('/catalog/public/register', {
                owner_name: form.owner_name,
                company_name: form.company_name,
                phone: form.phone,
                email: form.email,
                address: parsed.address,
                district: parsed.district,
                city: parsed.city,
                province: parsed.province,
                latitude: coords.latitude,
                longitude: coords.longitude,
                otp,
            });
        setBusy(false);
        if (res.ok) { setDoneMessage(res.message); setStep('done'); }
        else setError(res.message);
    };

    const switchMode = (next) => { setMode(next); setError(''); };

    const inputCls = `w-full px-3.5 py-2.5 rounded-xl text-sm border focus:outline-none focus:ring-2 focus:ring-gold-500/30 transition ${
        isDark ? 'bg-navy-800/60 border-white/10 text-white placeholder-navy-600 focus:border-gold-500/40'
               : 'bg-white border-gray-200 text-gray-900 placeholder-gray-400 focus:border-amber-400'}`;
    const labelCls = `block text-xs font-semibold mb-1.5 ${isDark ? 'text-navy-300' : 'text-gray-600'}`;

    return (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4" style={{ animation: 'fadeIn 0.2s ease' }} onClick={onClose}>
            <div className="absolute inset-0 bg-black/70 backdrop-blur-md" />
            <div
                className={`relative z-10 w-full sm:max-w-md rounded-t-3xl sm:rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[92dvh] ${isDark ? 'bg-navy-900 border border-white/10' : 'bg-white border border-gray-200'}`}
                style={{ animation: 'slideUp 0.25s cubic-bezier(0.34,1.4,0.64,1)' }}
                onClick={(e) => e.stopPropagation()}
            >
                <div className="h-1 w-full bg-gradient-to-r from-gold-600 via-gold-400 to-gold-600 shrink-0" />
                <div className="p-6 overflow-y-auto">
                    <div className="flex items-start justify-between gap-3 mb-5">
                        <div className="flex items-center gap-3">
                            <div className={`w-11 h-11 rounded-2xl flex items-center justify-center shrink-0 ${isDark ? 'bg-gold-500/10 border border-gold-500/25' : 'bg-amber-50 border border-amber-200'}`}>
                                <UserPlus className={`w-5 h-5 ${isDark ? 'text-gold-400' : 'text-amber-600'}`} />
                            </div>
                            <div>
                                <h2 className={`text-base font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>
                                    {mode === 'login' ? 'Verifikasi Channel Terdaftar' : 'Daftar sebagai Channel'}
                                </h2>
                                <p className={`text-xs mt-0.5 ${isDark ? 'text-navy-500' : 'text-gray-400'}`}>
                                    {step === 'otp' ? 'Verifikasi nomor WhatsApp Anda'
                                        : mode === 'login' ? 'Buka harga spesial dengan nomor WA terdaftar'
                                        : 'Jadi mitra & dapatkan harga spesial'}
                                </p>
                            </div>
                        </div>
                        <button onClick={onClose} className={`w-8 h-8 rounded-full flex items-center justify-center transition shrink-0 ${isDark ? 'text-navy-500 hover:text-white hover:bg-white/8' : 'text-gray-400 hover:text-gray-700 hover:bg-gray-100'}`}>
                            <X className="w-4 h-4" />
                        </button>
                    </div>

                    {error && (
                        <div className="mb-4 flex items-start gap-2 px-3.5 py-2.5 rounded-xl bg-red-500/10 border border-red-500/20 text-xs text-red-400">
                            <X className="w-3.5 h-3.5 shrink-0 mt-0.5" />{error}
                        </div>
                    )}

                    {step === 'form' && mode === 'login' && (
                        <div className="space-y-3.5">
                            <div>
                                <label className={labelCls}>No. WhatsApp Terdaftar</label>
                                <input className={inputCls} value={form.phone} onChange={set('phone')} inputMode="tel" placeholder="08xxxxxxxxxx" autoFocus />
                                <p className={`text-[10px] mt-1 ${isDark ? 'text-navy-500' : 'text-gray-400'}`}>Kode verifikasi dikirim ke nomor yang Anda pakai saat mendaftar.</p>
                            </div>
                            <button
                                onClick={sendOtp} disabled={busy}
                                className="w-full px-4 py-3 rounded-xl bg-gold-500 text-navy-950 text-sm font-bold hover:bg-gold-400 transition disabled:opacity-40 flex items-center justify-center gap-2"
                            >
                                {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <MessageCircle className="w-4 h-4" />}
                                Kirim Kode Verifikasi
                            </button>
                            <p className={`text-center text-[11px] ${isDark ? 'text-navy-500' : 'text-gray-400'}`}>
                                Belum jadi channel?{' '}
                                <button onClick={() => switchMode('register')} className={`font-semibold ${isDark ? 'text-gold-400 hover:text-gold-300' : 'text-amber-600 hover:text-amber-500'}`}>
                                    Daftar di sini
                                </button>
                            </p>
                        </div>
                    )}

                    {step === 'form' && mode === 'register' && (
                        <div className="space-y-3.5">
                            <div>
                                <label className={labelCls}>Nama Pemilik</label>
                                <input className={inputCls} value={form.owner_name} onChange={set('owner_name')} placeholder="Nama lengkap pemilik / PIC" />
                            </div>
                            <div>
                                <label className={labelCls}>Nama Perusahaan</label>
                                <input className={inputCls} value={form.company_name} onChange={set('company_name')} placeholder="PT / CV / Toko" />
                            </div>
                            <div>
                                <label className={labelCls}>No. WhatsApp</label>
                                <input className={inputCls} value={form.phone} onChange={set('phone')} inputMode="tel" placeholder="08xxxxxxxxxx" />
                                <p className={`text-[10px] mt-1 ${isDark ? 'text-navy-500' : 'text-gray-400'}`}>Kode verifikasi akan dikirim ke nomor ini — pastikan terdaftar di WhatsApp.</p>
                            </div>
                            <div>
                                <label className={labelCls}>Email</label>
                                <input className={inputCls} value={form.email} onChange={set('email')} type="email" placeholder="nama@perusahaan.com" />
                            </div>
                            <div>
                                <label className={labelCls}>Alamat Lengkap</label>
                                <textarea
                                    className={`${inputCls} resize-none`} rows={2}
                                    value={form.fullAddress} onChange={set('fullAddress')}
                                    placeholder="Jl. Contoh No. 1, Kota, Provinsi"
                                />
                                <div className="flex items-center justify-between gap-2 mt-1.5">
                                    <p className={`text-[10px] ${parsed?.city && parsed?.province ? 'text-emerald-500' : isDark ? 'text-navy-500' : 'text-gray-400'}`}>
                                        {parsed?.city && parsed?.province
                                            ? `✓ ${[parsed.district, parsed.city, parsed.province].filter(Boolean).join(' · ')}`
                                            : 'Format: Alamat, Kota, Provinsi (Kecamatan opsional)'}
                                    </p>
                                    <button
                                        onClick={findLocation} disabled={geoState.busy || !parsed}
                                        className={`shrink-0 flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-semibold border transition disabled:opacity-40 ${isDark ? 'border-white/10 text-navy-300 hover:text-white hover:bg-white/5' : 'border-gray-200 text-gray-500 hover:text-gray-900 hover:bg-gray-50'}`}
                                    >
                                        {geoState.busy ? <Loader2 className="w-3 h-3 animate-spin" /> : <MapPin className="w-3 h-3" />} Cari Lokasi
                                    </button>
                                </div>
                                {geoState.note && <p className={`text-[10px] mt-1 ${geoState.note.startsWith('✓') ? 'text-emerald-500' : isDark ? 'text-navy-500' : 'text-gray-400'}`}>{geoState.note}</p>}
                            </div>

                            <button
                                onClick={sendOtp} disabled={busy}
                                className="w-full px-4 py-3 rounded-xl bg-gold-500 text-navy-950 text-sm font-bold hover:bg-gold-400 transition disabled:opacity-40 flex items-center justify-center gap-2"
                            >
                                {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <MessageCircle className="w-4 h-4" />}
                                Kirim Kode Verifikasi WhatsApp
                            </button>
                            <p className={`text-center text-[11px] ${isDark ? 'text-navy-500' : 'text-gray-400'}`}>
                                Sudah terdaftar sebagai channel?{' '}
                                <button onClick={() => switchMode('login')} className={`font-semibold ${isDark ? 'text-gold-400 hover:text-gold-300' : 'text-amber-600 hover:text-amber-500'}`}>
                                    Aktifkan harga spesial
                                </button>
                            </p>
                        </div>
                    )}

                    {step === 'otp' && (
                        <div className="space-y-4">
                            <p className={`text-sm ${isDark ? 'text-navy-300' : 'text-gray-600'}`}>
                                Kode 6 digit telah dikirim via WhatsApp ke <span className={`font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>{form.phone}</span>.
                            </p>
                            <input
                                className={`${inputCls} text-center text-2xl font-black tracking-[0.4em]`}
                                value={otp}
                                onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                                inputMode="numeric" autoFocus placeholder="••••••"
                            />
                            <button
                                onClick={submit} disabled={busy || otp.length !== 6}
                                className="w-full px-4 py-3 rounded-xl bg-gold-500 text-navy-950 text-sm font-bold hover:bg-gold-400 transition disabled:opacity-40 flex items-center justify-center gap-2"
                            >
                                {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                                Daftar Sekarang
                            </button>
                            <div className="flex items-center justify-between text-[11px]">
                                <button onClick={() => { setStep('form'); setError(''); }} className={`${isDark ? 'text-navy-400 hover:text-white' : 'text-gray-400 hover:text-gray-700'} transition`}>
                                    ← Ubah data
                                </button>
                                <button
                                    onClick={sendOtp} disabled={cooldown > 0 || busy}
                                    className={`font-semibold transition disabled:opacity-40 ${isDark ? 'text-gold-400 hover:text-gold-300' : 'text-amber-600 hover:text-amber-500'}`}
                                >
                                    {cooldown > 0 ? `Kirim ulang (${cooldown}s)` : 'Kirim ulang kode'}
                                </button>
                            </div>
                        </div>
                    )}

                    {step === 'done' && (
                        <div className="text-center py-4">
                            <div className="w-16 h-16 rounded-full bg-emerald-500/10 border border-emerald-500/25 flex items-center justify-center mx-auto mb-4">
                                <CheckCircle2 className="w-8 h-8 text-emerald-500" />
                            </div>
                            <h3 className={`text-lg font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>
                                {mode === 'login' ? 'Verifikasi Berhasil!' : 'Pendaftaran Diterima!'}
                            </h3>
                            <p className={`text-sm mt-2 leading-relaxed ${isDark ? 'text-navy-400' : 'text-gray-500'}`}>{doneMessage}</p>
                            {/* Reload so the payload is refetched with the unlocked session */}
                            <button
                                onClick={() => window.location.reload()}
                                className="mt-5 px-6 py-2.5 rounded-xl bg-gold-500 text-navy-950 text-sm font-bold hover:bg-gold-400 transition inline-flex items-center gap-2"
                            >
                                <Sparkles className="w-4 h-4" /> Lihat Harga Spesial
                            </button>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
