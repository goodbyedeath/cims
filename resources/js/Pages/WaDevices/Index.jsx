import { useState, useEffect, useRef } from 'react';
import { useForm, router } from '@inertiajs/react';
import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import Card from '@/Components/ui/Card';
import Button from '@/Components/ui/Button';
import Input from '@/Components/ui/Input';
import Badge from '@/Components/ui/Badge';
import Modal from '@/Components/ui/Modal';
import { formatDate, cn, csrfHeaders } from '@/Lib/utils';
import {
    Smartphone, Plus, Pencil, Trash2, RefreshCw, QrCode, Power, Unplug,
    RotateCcw, Send, Gauge, CheckCircle, AlertTriangle, Server, KeyRound,
    Loader2, ExternalLink,
} from 'lucide-react';

// Traffic purposes — one device may be active per purpose. Sending falls back
// purpose → Umum → any active device → .env token.
const PURPOSES = {
    general: { label: 'Umum', hint: 'Semua pengiriman (default)', badge: 'bg-white/5 text-navy-300 border-white/10' },
    otp: { label: 'OTP', hint: 'Verifikasi & pesan transaksional', badge: 'bg-sky-500/10 text-sky-400 border-sky-500/20' },
    blast: { label: 'Blast', hint: 'Kampanye massal / bulk', badge: 'bg-purple-500/10 text-purple-400 border-purple-500/20' },
};

const STATUS_STYLES = {
    connected: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
    disconnected: 'bg-red-500/10 text-red-400 border-red-500/20',
    error: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
    unknown: 'bg-white/5 text-navy-300 border-white/10',
};

const EMPTY = {
    name: '', purpose: 'general', server_url: 'https://jkt.wablas.com', token: '', secret_key: '',
    scan_path: '', phone: '', is_active: false,
};

// Scalar facts worth surfacing from the gateway's /device/info payload —
// shown generically so shape differences between Wablas plans don't break us.
function infoFacts(info) {
    const data = info?.data;
    if (!data || typeof data !== 'object') return [];
    return Object.entries(data)
        .filter(([, v]) => ['string', 'number', 'boolean'].includes(typeof v))
        .slice(0, 6);
}

function DeviceCard({ device }) {
    const [busy, setBusy] = useState(null);

    const act = (action, url, opts = {}) => {
        setBusy(action);
        router.post(url, opts.data ?? {}, {
            preserveScroll: true,
            onFinish: () => setBusy(null),
        });
    };

    const refresh = () => act('refresh', `/wa-devices/${device.id}/refresh`);
    const activate = () => act('activate', `/wa-devices/${device.id}/activate`);

    const disconnect = () => {
        if (confirm(`Putuskan sesi WhatsApp device "${device.name}" dari server?`)) {
            act('disconnect', `/wa-devices/${device.id}/disconnect`);
        }
    };

    const restart = () => {
        if (confirm(`Restart device "${device.name}" di server gateway?`)) {
            act('restart', `/wa-devices/${device.id}/restart`);
        }
    };

    const testSend = () => {
        const phone = prompt('Kirim pesan test ke nomor (08xx / 628xx):');
        if (phone) act('test', `/wa-devices/${device.id}/test`, { data: { phone } });
    };

    const changeSpeed = () => {
        const delay = prompt('Delay pengiriman per 5 pesan, dalam detik (10–120):', '10');
        if (delay) act('speed', `/wa-devices/${device.id}/speed`, { data: { delay } });
    };

    const facts = infoFacts(device.last_info);

    return (
        <Card className={device.is_active ? 'border-gold-500/30' : ''}>
            <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                    <div className={`p-2.5 rounded-xl shrink-0 ${device.is_active ? 'bg-gold-500/10 text-gold-400' : 'bg-white/5 text-navy-300'}`}>
                        <Smartphone className="w-5 h-5" />
                    </div>
                    <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                            <h3 className="font-semibold text-white truncate">{device.name}</h3>
                            {device.is_active && (
                                <Badge className="bg-gold-500/10 text-gold-400 border-gold-500/20">
                                    <CheckCircle className="w-3 h-3 mr-1" /> Aktif
                                </Badge>
                            )}
                            <Badge
                                className={(PURPOSES[device.purpose] ?? PURPOSES.general).badge}
                                title={(PURPOSES[device.purpose] ?? PURPOSES.general).hint}
                            >
                                {(PURPOSES[device.purpose] ?? PURPOSES.general).label}
                            </Badge>
                            <Badge className={STATUS_STYLES[device.last_status] ?? STATUS_STYLES.unknown}>
                                {device.last_status}
                            </Badge>
                        </div>
                        <p className="text-xs text-navy-400 mt-1 truncate">
                            {device.phone ? `${device.phone} · ` : ''}{device.server_url.replace('https://', '')}
                            {device.token_hint && <span className="ml-1 text-navy-500">token {device.token_hint}</span>}
                        </p>
                    </div>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                    <button onClick={() => device.onEdit(device)} className="p-1.5 rounded-lg text-navy-400 hover:text-white hover:bg-white/5 transition" title="Edit">
                        <Pencil className="w-4 h-4" />
                    </button>
                    <button
                        onClick={() => {
                            if (confirm(`Hapus device "${device.name}"?`)) {
                                router.delete(`/wa-devices/${device.id}`, { preserveScroll: true });
                            }
                        }}
                        className="p-1.5 rounded-lg text-navy-400 hover:text-red-400 hover:bg-red-500/10 transition"
                        title="Hapus"
                    >
                        <Trash2 className="w-4 h-4" />
                    </button>
                </div>
            </div>

            {facts.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-1.5">
                    {facts.map(([k, v]) => (
                        <span key={k} className="px-2 py-0.5 rounded-md bg-white/5 border border-white/5 text-[11px] text-navy-300">
                            <span className="text-navy-500">{k}:</span> {String(v)}
                        </span>
                    ))}
                </div>
            )}
            {device.last_checked_at && (
                <p className="mt-2 text-[11px] text-navy-500">Terakhir dicek: {formatDate(device.last_checked_at)}</p>
            )}

            <div className="mt-4 flex flex-wrap gap-2">
                <Button size="sm" variant="secondary" onClick={refresh} disabled={busy !== null}>
                    <RefreshCw className={`w-3.5 h-3.5 ${busy === 'refresh' ? 'animate-spin' : ''}`} /> Cek Status
                </Button>
                <Button size="sm" variant="secondary" onClick={() => device.onQr(device)}>
                    <QrCode className="w-3.5 h-3.5" /> Scan QR
                </Button>
                {!device.is_active && (
                    <Button size="sm" variant="secondary" onClick={activate} disabled={busy !== null}>
                        <Power className="w-3.5 h-3.5" /> Jadikan Aktif
                    </Button>
                )}
                <Button size="sm" variant="secondary" onClick={testSend} disabled={busy !== null}>
                    <Send className="w-3.5 h-3.5" /> Test Kirim
                </Button>
                <Button size="sm" variant="secondary" onClick={changeSpeed} disabled={busy !== null} title="Delay antar batch 5 pesan (anti-ban)">
                    <Gauge className="w-3.5 h-3.5" /> Speed
                </Button>
                <Button size="sm" variant="secondary" onClick={restart} disabled={busy !== null}>
                    <RotateCcw className="w-3.5 h-3.5" /> Restart
                </Button>
                <Button size="sm" variant="danger" onClick={disconnect} disabled={busy !== null}>
                    <Unplug className="w-3.5 h-3.5" /> Disconnect
                </Button>
            </div>
        </Card>
    );
}

// Pairing-QR modal. WhatsApp rotates the pairing QR every ~20 s, so a static
// snapshot goes stale before most people finish scanning (the phone "scans"
// fine, the link silently fails). This modal mirrors the gateway's own page:
// start a scan session ONCE (qr-start; resetting mid-session aborts an
// in-flight handshake), then poll qr-frame every 2.5 s and hot-swap the image
// whenever the code rotates. qr-status polling flips to a success screen the
// moment the device reports "connected".
function QrModal({ device, onClose }) {
    const [qrSrc, setQrSrc] = useState(null);
    const [stamp, setStamp] = useState('');
    const [failed, setFailed] = useState(false);
    const [connected, setConnected] = useState(false);
    const stampRef = useRef('');
    const restartingRef = useRef(false);

    const start = async () => {
        setFailed(false); setQrSrc(null); setStamp(''); stampRef.current = '';
        try {
            const res = await fetch(`/wa-devices/${device.id}/qr-start`, {
                method: 'POST',
                headers: { ...csrfHeaders(), Accept: 'application/json' },
            });
            if (!res.ok) setFailed(true);
        } catch {
            setFailed(true);
        }
    };

    // Kick off the scan session when the modal opens.
    useEffect(() => { if (device) start(); }, [device?.id]); // eslint-disable-line react-hooks/exhaustive-deps

    // Poll the rotating QR frame.
    useEffect(() => {
        if (!device || connected || failed) return undefined;
        const id = setInterval(async () => {
            try {
                const res = await fetch(`/wa-devices/${device.id}/qr-frame?since=${stampRef.current}`, {
                    headers: { Accept: 'application/json' },
                });
                if (!res.ok) return;
                const f = await res.json();
                if (f.ok && f.changed) {
                    stampRef.current = f.stamp;
                    setStamp(f.stamp);
                    setQrSrc(f.image);
                } else if (!f.ok && f.expired && !restartingRef.current) {
                    // Scan session ran out (~46 s of no scan) — start a new one.
                    restartingRef.current = true;
                    await start();
                    restartingRef.current = false;
                }
            } catch { /* network blip — keep polling */ }
        }, 2500);
        return () => clearInterval(id);
    }, [device, connected, failed]);

    // Poll pairing status — success feedback without the user doing anything.
    useEffect(() => {
        if (!device || connected) return undefined;
        const id = setInterval(async () => {
            try {
                const res = await fetch(`/wa-devices/${device.id}/qr-status`, { headers: { Accept: 'application/json' } });
                if (res.ok && (await res.json()).connected) setConnected(true);
            } catch { /* network blip — keep polling */ }
        }, 5000);
        return () => clearInterval(id);
    }, [device, connected]);

    const finish = () => { onClose(); router.reload({ only: ['devices'] }); };

    return (
        <Modal show={device !== null} onClose={connected ? finish : onClose} title={device ? `Scan QR — ${device.name}` : ''} maxWidth="max-w-md">
            {device && (connected ? (
                <div className="text-center py-6">
                    <div className="w-16 h-16 rounded-full bg-emerald-500/10 border border-emerald-500/25 flex items-center justify-center mx-auto mb-4">
                        <CheckCircle className="w-8 h-8 text-emerald-500" />
                    </div>
                    <h3 className="text-lg font-bold text-white">Device Terhubung!</h3>
                    <p className="text-sm text-navy-400 mt-2">WhatsApp berhasil ditautkan — device siap mengirim pesan.</p>
                    <Button className="mt-5" onClick={finish}>Selesai</Button>
                </div>
            ) : (
                <div className="space-y-4">
                    <p className="text-sm text-navy-300">
                        Buka WhatsApp di HP <span className="text-white">{device.phone || ''}</span> →{' '}
                        <span className="text-white">Perangkat Tertaut (Linked Devices)</span> →{' '}
                        <span className="text-white">Tautkan Perangkat</span>, lalu scan QR di bawah.
                        Kode diperbarui otomatis — scan kapan saja.
                    </p>

                    <div className="relative mx-auto w-72 h-72 rounded-2xl overflow-hidden border border-white/10 bg-white flex items-center justify-center">
                        {failed ? (
                            <div className="flex flex-col items-center gap-3 p-6 text-center bg-navy-900 absolute inset-0 justify-center">
                                <AlertTriangle className="w-7 h-7 text-amber-400" />
                                <p className="text-xs text-navy-300">
                                    Gagal memulai sesi QR di gateway. Pastikan token device valid ("Cek Status"), lalu coba lagi.
                                </p>
                                <Button size="sm" variant="secondary" onClick={start}>
                                    <RefreshCw className="w-3.5 h-3.5" /> Coba lagi
                                </Button>
                            </div>
                        ) : qrSrc ? (
                            <img
                                key={stamp}
                                src={qrSrc}
                                alt={`QR pairing ${device.name}`}
                                className="w-64 h-64 object-contain"
                            />
                        ) : (
                            <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-navy-900">
                                <Loader2 className="w-6 h-6 text-gold-400 animate-spin" />
                                <p className="text-xs text-navy-400">Menyiapkan QR dari gateway…</p>
                            </div>
                        )}
                    </div>

                    <div className="flex items-center justify-between gap-2 flex-wrap">
                        <p className="text-[11px] text-navy-500 flex items-center gap-1.5">
                            <Loader2 className="w-3 h-3 animate-spin" />
                            {qrSrc ? 'QR live — menunggu scan, status dicek otomatis…' : 'Menghubungi gateway…'}
                        </p>
                        <div className="flex gap-2">
                            <Button size="sm" variant="secondary" onClick={start}>
                                <RefreshCw className="w-3.5 h-3.5" /> Mulai ulang
                            </Button>
                            {/* Fallback: the gateway's own scan page in a full tab */}
                            <a href={`/wa-devices/${device.id}/qr`} target="_blank" rel="noopener noreferrer">
                                <Button size="sm" variant="ghost"><ExternalLink className="w-3.5 h-3.5" /> Buka di tab baru</Button>
                            </a>
                        </div>
                    </div>
                </div>
            ))}
        </Modal>
    );
}

export default function WaDevicesIndex({ devices, env_fallback, driver, meta, blastSettings }) {
    const [showModal, setShowModal] = useState(false);
    const [editingId, setEditingId] = useState(null);
    const [qrDevice, setQrDevice] = useState(null);
    const [switching, setSwitching] = useState(null);
    const [showBlastCfg, setShowBlastCfg] = useState(false);

    const blastForm = useForm({ ...(blastSettings || {}) });
    const saveBlastCfg = (e) => {
        e.preventDefault();
        blastForm.post('/wa-devices/blast-settings', { preserveScroll: true });
    };
    const BLAST_FIELDS = [
        { key: 'blast_cooldown_days', label: 'Cooldown (hari)', hint: 'Skip channel yang baru diblast. 0 = nonaktif' },
        { key: 'blast_disconnect_giveup_hours', label: 'Give-up disconnect (jam)', hint: 'Gagal jika device offline terus-menerus selama ini' },
        { key: 'blast_drip_hour_start', label: 'Drip jam mulai', hint: 'Jam WIB (0–23)' },
        { key: 'blast_drip_hour_end', label: 'Drip jam selesai', hint: 'Jam WIB, harus > mulai' },
        { key: 'blast_drip_warmup_days', label: 'Warm-up (hari)', hint: 'Jatah harian naik penuh setelah sekian hari' },
        { key: 'blast_drip_daily_min', label: 'Jatah harian min', hint: 'Batas bawah pesan/hari (nomor hangat)' },
        { key: 'blast_drip_daily_max', label: 'Jatah harian max', hint: 'Batas atas pesan/hari (nomor hangat)' },
        { key: 'blast_drip_rest_pct', label: 'Peluang rest day (%)', hint: 'Kemungkinan libur ekstra antar hari kirim' },
    ];

    const switchDriver = (next) => {
        if (next === driver || switching) return;
        if (next === 'meta' && !meta?.send_ready
            && !confirm('Kredensial Meta (Phone Number ID / Access Token) belum diisi — pengiriman akan gagal sampai diisi di .env. Tetap aktifkan Meta?')) return;
        setSwitching(next);
        router.post('/wa-devices/driver', { driver: next }, {
            preserveScroll: true,
            onFinish: () => setSwitching(null),
        });
    };

    const { data, setData, post, put, processing, errors, reset, clearErrors } = useForm({ ...EMPTY });

    const openCreate = () => {
        reset(); clearErrors(); setData({ ...EMPTY }); setEditingId(null); setShowModal(true);
    };

    const openEdit = (device) => {
        clearErrors();
        setData({
            name: device.name,
            purpose: device.purpose ?? 'general',
            server_url: device.server_url,
            token: '',        // blank = keep current
            secret_key: '',   // blank = keep current
            scan_path: device.scan_path ?? '',
            phone: device.phone ?? '',
            is_active: device.is_active,
        });
        setEditingId(device.id);
        setShowModal(true);
    };

    const submit = (e) => {
        e.preventDefault();
        const opts = { preserveScroll: true, onSuccess: () => setShowModal(false) };
        if (editingId) put(`/wa-devices/${editingId}`, opts);
        else post('/wa-devices', opts);
    };

    return (
        <AuthenticatedLayout title="WA Devices">
            <div className="space-y-6">
                <div className="flex items-center justify-between gap-3 flex-wrap">
                    <div>
                        <h1 className="text-2xl font-bold text-white flex items-center gap-2">
                            <Smartphone className="w-6 h-6 text-gold-400" /> WhatsApp Devices
                        </h1>
                        <p className="text-sm text-navy-400 mt-1">
                            Kelola device gateway Wablas — device aktif dipakai untuk semua pengiriman (blast, chatbot, form).
                        </p>
                    </div>
                    <Button onClick={openCreate}><Plus className="w-4 h-4" /> Tambah Device</Button>
                </div>

                {/* ── Provider switch: Baileys gateway ⇄ Meta Cloud API ── */}
                <Card>
                    <div className="flex items-start gap-3 mb-4">
                        <Server className="w-5 h-5 text-gold-400 shrink-0 mt-0.5" />
                        <div>
                            <h2 className="text-sm font-semibold text-white">Provider Pengiriman WhatsApp</h2>
                            <p className="text-xs text-navy-400 mt-0.5">
                                Menentukan jalur semua pengiriman (OTP, blast, chatbot, form). Berlaku langsung tanpa restart.
                            </p>
                        </div>
                    </div>
                    <div className="grid gap-3 sm:grid-cols-2">
                        {[
                            {
                                id: 'baileys', label: 'Baileys Gateway', sub: 'Self-hosted (b2bsales.space)',
                                ready: true, readyText: 'Device dikelola di bawah',
                            },
                            {
                                id: 'meta', label: 'Meta Cloud API', sub: 'Official WhatsApp Business',
                                ready: meta?.send_ready, readyText: meta?.send_ready ? 'Kredensial terpasang' : 'Kredensial belum diisi (.env)',
                            },
                        ].map((opt) => {
                            const active = driver === opt.id;
                            return (
                                <button
                                    key={opt.id}
                                    type="button"
                                    onClick={() => switchDriver(opt.id)}
                                    disabled={switching}
                                    className={cn(
                                        'text-left rounded-xl border p-4 transition disabled:opacity-60',
                                        active
                                            ? 'border-gold-500/50 bg-gold-500/10 ring-1 ring-gold-500/30'
                                            : 'border-white/10 bg-navy-800/40 hover:bg-white/5',
                                    )}
                                >
                                    <div className="flex items-center justify-between gap-2">
                                        <span className="text-sm font-semibold text-white">{opt.label}</span>
                                        {switching === opt.id ? (
                                            <Loader2 className="w-4 h-4 text-gold-400 animate-spin" />
                                        ) : active ? (
                                            <Badge className="bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">Aktif</Badge>
                                        ) : (
                                            <span className="text-[11px] text-navy-500">pilih</span>
                                        )}
                                    </div>
                                    <p className="text-xs text-navy-400 mt-0.5">{opt.sub}</p>
                                    <div className={cn('flex items-center gap-1.5 mt-2 text-[11px]', opt.ready ? 'text-emerald-400' : 'text-amber-400')}>
                                        {opt.ready ? <CheckCircle className="w-3.5 h-3.5" /> : <AlertTriangle className="w-3.5 h-3.5" />}
                                        {opt.readyText}
                                    </div>
                                </button>
                            );
                        })}
                    </div>
                    {driver === 'meta' && (
                        <p className={cn('text-xs mt-3 flex items-center gap-1.5', meta?.webhook_ready ? 'text-navy-400' : 'text-amber-400')}>
                            {meta?.webhook_ready ? <CheckCircle className="w-3.5 h-3.5" /> : <AlertTriangle className="w-3.5 h-3.5" />}
                            Webhook masuk {meta?.webhook_ready ? 'siap (verify token & app secret terpasang).' : 'belum lengkap — isi WHATSAPP_CLOUD_VERIFY_TOKEN & META_APP_SECRET agar chatbot balas otomatis.'}
                        </p>
                    )}
                    {driver === 'meta' && (
                        <p className="text-[11px] text-navy-500 mt-2">
                            Mode Meta: pengaturan device & QR di bawah tidak dipakai (Meta tanpa QR).
                        </p>
                    )}
                </Card>

                {/* ── Blast anti-ban settings ── */}
                {blastSettings && (
                    <Card>
                        <button
                            type="button"
                            onClick={() => setShowBlastCfg((v) => !v)}
                            className="w-full flex items-center justify-between gap-3 text-left"
                        >
                            <div className="flex items-center gap-3">
                                <Gauge className="w-5 h-5 text-gold-400 shrink-0" />
                                <div>
                                    <h2 className="text-sm font-semibold text-white">Pengaturan Blast (anti-ban)</h2>
                                    <p className="text-xs text-navy-400 mt-0.5">Cooldown, jendela drip, warm-up nomor, jatah harian.</p>
                                </div>
                            </div>
                            <span className="text-xs text-navy-400">{showBlastCfg ? 'Tutup' : 'Atur'}</span>
                        </button>
                        {showBlastCfg && (
                            <form onSubmit={saveBlastCfg} className="mt-4 pt-4 border-t border-white/5">
                                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                                    {BLAST_FIELDS.map((f) => (
                                        <div key={f.key}>
                                            <label className="block text-xs font-medium text-navy-200 mb-1">{f.label}</label>
                                            <input
                                                type="number"
                                                value={blastForm.data[f.key] ?? ''}
                                                onChange={(e) => blastForm.setData(f.key, e.target.value === '' ? '' : Number(e.target.value))}
                                                className="w-full px-3 py-2 bg-navy-800/60 border border-white/10 rounded-lg text-sm text-white focus:outline-none focus:ring-2 focus:ring-gold-500/30"
                                            />
                                            <p className="text-[10px] text-navy-500 mt-1 leading-tight">{f.hint}</p>
                                            {blastForm.errors[f.key] && <p className="text-[10px] text-red-400 mt-0.5">{blastForm.errors[f.key]}</p>}
                                        </div>
                                    ))}
                                </div>
                                <div className="flex items-center gap-3 mt-4">
                                    <Button type="submit" disabled={blastForm.processing}>
                                        {blastForm.processing ? 'Menyimpan…' : 'Simpan Pengaturan'}
                                    </Button>
                                    <p className="text-[11px] text-navy-500">Berlaku untuk blast berikutnya.</p>
                                </div>
                            </form>
                        )}
                    </Card>
                )}

                {env_fallback && driver === 'baileys' && (
                    <Card className="border-amber-500/20 bg-amber-500/5">
                        <div className="flex items-start gap-3">
                            <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
                            <div className="text-sm text-navy-200">
                                <p className="font-medium text-amber-300">Belum ada device aktif — sistem memakai token dari file .env.</p>
                                <p className="text-navy-400 mt-1">
                                    Tambahkan device di sini lalu tandai "Aktif" agar token dikelola dari halaman ini
                                    (terenkripsi di database) tanpa perlu mengubah .env lagi.
                                </p>
                            </div>
                        </div>
                    </Card>
                )}

                {devices.length === 0 ? (
                    <Card className="text-center py-12">
                        <Smartphone className="w-10 h-10 text-navy-500 mx-auto" />
                        <p className="text-navy-300 mt-3">Belum ada device terdaftar.</p>
                        <p className="text-sm text-navy-500 mt-1">Tambahkan device Wablas pertama Anda untuk mulai mengelola pengiriman WhatsApp.</p>
                        <Button className="mt-4" onClick={openCreate}><Plus className="w-4 h-4" /> Tambah Device</Button>
                    </Card>
                ) : (
                    <div className="grid gap-4 lg:grid-cols-2">
                        {devices.map((device) => (
                            <DeviceCard key={device.id} device={{ ...device, onEdit: openEdit, onQr: setQrDevice }} />
                        ))}
                    </div>
                )}

                <QrModal device={qrDevice} onClose={() => setQrDevice(null)} />

                <Modal show={showModal} onClose={() => setShowModal(false)} title={editingId ? 'Edit Device' : 'Tambah Device'}>
                    <form onSubmit={submit} className="space-y-4">
                        <Input
                            label="Nama device"
                            value={data.name}
                            onChange={(e) => setData('name', e.target.value)}
                            placeholder='mis. "Sales Utama", "CS Support"'
                            error={errors.name}
                        />
                        {errors.name && <p className="text-xs text-red-400">{errors.name}</p>}

                        <div className="space-y-1.5">
                            <label className="block text-sm font-medium text-navy-200">Fungsi device</label>
                            <div className="grid grid-cols-3 gap-2">
                                {Object.entries(PURPOSES).map(([value, { label, hint }]) => (
                                    <button
                                        key={value}
                                        type="button"
                                        onClick={() => setData('purpose', value)}
                                        className={cn(
                                            'px-3 py-2.5 rounded-lg border text-left transition',
                                            data.purpose === value
                                                ? 'bg-gold-500/10 border-gold-500/40 text-gold-400'
                                                : 'bg-navy-800/50 border-white/10 text-navy-300 hover:text-white hover:border-white/25',
                                        )}
                                    >
                                        <span className="block text-xs font-bold">{label}</span>
                                        <span className="block text-[10px] mt-0.5 opacity-70 leading-tight">{hint}</span>
                                    </button>
                                ))}
                            </div>
                            <p className="text-[11px] text-navy-500">
                                Satu device aktif per fungsi. Jika fungsi khusus tidak tersedia, pengiriman otomatis memakai device "Umum" yang aktif.
                            </p>
                            {errors.purpose && <p className="text-xs text-red-400">{errors.purpose}</p>}
                        </div>

                        <Input
                            label="Server Wablas"
                            value={data.server_url}
                            onChange={(e) => setData('server_url', e.target.value)}
                            placeholder="https://jkt.wablas.com"
                            error={errors.server_url}
                        />
                        {errors.server_url && <p className="text-xs text-red-400">{errors.server_url}</p>}

                        <Input
                            label={editingId ? 'Token (kosongkan jika tidak diganti)' : 'Token'}
                            value={data.token}
                            onChange={(e) => setData('token', e.target.value)}
                            placeholder="Token dari menu Device → Settings di Wablas"
                            peek
                            error={errors.token}
                        />
                        {errors.token && <p className="text-xs text-red-400">{errors.token}</p>}

                        <Input
                            label={editingId ? 'Secret key (kosongkan jika tidak diganti)' : 'Secret key (opsional)'}
                            value={data.secret_key}
                            onChange={(e) => setData('secret_key', e.target.value)}
                            placeholder="Diperlukan untuk disconnect / restart / speed"
                            peek
                            error={errors.secret_key}
                        />

                        <div className="space-y-1.5">
                            <Input
                                label="Endpoint QR connector (opsional)"
                                value={data.scan_path}
                                onChange={(e) => setData('scan_path', e.target.value)}
                                placeholder="/api/device/scan?token={token}"
                                error={errors.scan_path}
                            />
                            <p className="text-[11px] text-navy-500">
                                Kosongkan untuk endpoint standar Wablas. Gunakan <code className="text-navy-400">{'{token}'}</code>{' '}
                                sebagai placeholder token — berguna jika server/paket gateway Anda memakai path QR yang berbeda.
                            </p>
                        </div>
                        {errors.scan_path && <p className="text-xs text-red-400">{errors.scan_path}</p>}

                        <Input
                            label="Nomor WhatsApp (opsional)"
                            value={data.phone}
                            onChange={(e) => setData('phone', e.target.value)}
                            placeholder="628xxxxxxxxxx"
                            error={errors.phone}
                        />

                        <label className="flex items-center gap-2 text-sm text-navy-200 cursor-pointer">
                            <input
                                type="checkbox"
                                checked={data.is_active}
                                onChange={(e) => setData('is_active', e.target.checked)}
                                className="rounded border-white/20 bg-navy-800 text-gold-500 focus:ring-gold-500/30"
                            />
                            Jadikan device aktif untuk pengiriman
                        </label>

                        <div className="flex items-center gap-2 text-xs text-navy-500">
                            <KeyRound className="w-3.5 h-3.5 shrink-0" />
                            Token & secret disimpan terenkripsi di database dan tidak pernah dikirim kembali ke halaman ini.
                        </div>

                        <div className="flex justify-end gap-2 pt-2">
                            <Button type="button" variant="ghost" onClick={() => setShowModal(false)}>Batal</Button>
                            <Button type="submit" disabled={processing}>
                                {editingId ? 'Simpan Perubahan' : 'Tambah Device'}
                            </Button>
                        </div>
                    </form>
                </Modal>
            </div>
        </AuthenticatedLayout>
    );
}
