import { Link, router } from '@inertiajs/react';
import { useState, useEffect, useRef } from 'react';
import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import Card from '@/Components/ui/Card';
import Badge from '@/Components/ui/Badge';
import Button from '@/Components/ui/Button';
import { Table, Thead, Tbody, Tr, Th, Td } from '@/Components/ui/Table';
import { formatDate } from '@/Lib/utils';
import { ArrowLeft, CheckCircle, XCircle, Clock, MessageSquare, Ban, RotateCcw, Smartphone, MinusCircle, FileText, Eye, EyeOff } from 'lucide-react';

// Blast lifecycle: active states keep polling; terminal states stop.
const ACTIVE = ['queued', 'scheduled', 'sending', 'cancelling'];
const TERMINAL = ['completed', 'failed', 'cancelled'];

const BLAST_BADGE = {
    draft: 'bg-navy-700 text-navy-200',
    queued: 'bg-sky-500/20 text-sky-400',
    scheduled: 'bg-indigo-500/20 text-indigo-300',
    sending: 'bg-yellow-500/20 text-yellow-400',
    cancelling: 'bg-orange-500/20 text-orange-400',
    completed: 'bg-emerald-500/20 text-emerald-400',
    failed: 'bg-red-500/20 text-red-400',
    cancelled: 'bg-navy-600 text-navy-300',
};

const RECIP_BADGE = {
    pending: 'bg-navy-700 text-navy-200',
    sent: 'bg-emerald-500/20 text-emerald-400',
    failed: 'bg-red-500/20 text-red-400',
    skipped: 'bg-amber-500/20 text-amber-400',
    cancelled: 'bg-navy-600 text-navy-300',
};

export default function Show({ blast, fileTracking }) {
    const [openTab, setOpenTab] = useState('opened');
    // Live counters (server is the source of truth while the blast runs).
    const [live, setLive] = useState({
        status: blast.status,
        sent_count: blast.sent_count,
        failed_count: blast.failed_count,
        total: blast.total_recipients,
        pending: null,
        scheduled_at: blast.scheduled_at,
    });
    const timer = useRef(null);

    useEffect(() => {
        if (!ACTIVE.includes(live.status)) return undefined;
        const poll = async () => {
            try {
                const res = await fetch(`/wa-blast/${blast.id}/progress`, { headers: { Accept: 'application/json' } });
                const json = await res.json();
                setLive(json);
                // When it finishes, refresh the recipients table once.
                if (TERMINAL.includes(json.status)) router.reload({ only: ['blast'], preserveScroll: true });
            } catch { /* keep last known */ }
        };
        timer.current = setInterval(poll, 4000);
        return () => clearInterval(timer.current);
    }, [live.status, blast.id]);

    const done = (live.sent_count || 0) + (live.failed_count || 0);
    const pct = live.total > 0 ? Math.min(100, Math.round((done / live.total) * 100)) : 0;
    const isActive = ACTIVE.includes(live.status);
    const canRetry = TERMINAL.includes(live.status) && (live.failed_count > 0 || live.status === 'cancelled' || live.status === 'failed');

    const cancel = () => {
        if (!confirm('Hentikan blast ini? Sisa penerima tidak akan dikirim.')) return;
        router.post(`/wa-blast/${blast.id}/cancel`, {}, { preserveScroll: true });
    };
    const retry = () => {
        if (!confirm('Kirim ulang penerima yang gagal / dibatalkan?')) return;
        router.post(`/wa-blast/${blast.id}/retry`, {}, { preserveScroll: true });
    };

    return (
        <AuthenticatedLayout title={`Blast: ${blast.title}`}>
            <div className="mb-6 flex items-center justify-between gap-3 flex-wrap">
                <Link href="/wa-blast" className="inline-flex items-center gap-2 text-sm text-navy-400 hover:text-white transition">
                    <ArrowLeft className="w-4 h-4" /> Back to WA Blast
                </Link>
                <div className="flex items-center gap-2">
                    {(isActive) && (
                        <Button variant="secondary" onClick={cancel} disabled={live.status === 'cancelling'}>
                            <Ban className="w-4 h-4" /> {live.status === 'cancelling' ? 'Menghentikan…' : 'Hentikan'}
                        </Button>
                    )}
                    {canRetry && (
                        <Button onClick={retry}><RotateCcw className="w-4 h-4" /> Kirim Ulang yang Gagal</Button>
                    )}
                </div>
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 mb-6">
                {/* Blast Info */}
                <Card>
                    <div className="flex items-center gap-3 mb-4">
                        <MessageSquare className="w-5 h-5 text-gold-400" />
                        <h3 className="text-lg font-semibold text-white">Blast Info</h3>
                    </div>
                    <div className="space-y-3 text-sm">
                        <div className="flex justify-between">
                            <span className="text-navy-400">Title</span>
                            <span className="text-white font-medium">{blast.title}</span>
                        </div>
                        <div className="flex justify-between">
                            <span className="text-navy-400">Sent By</span>
                            <span className="text-white">{blast.user?.name}</span>
                        </div>
                        {blast.device?.name && (
                            <div className="flex justify-between items-center">
                                <span className="text-navy-400">Device</span>
                                <span className="text-white inline-flex items-center gap-1.5">
                                    <Smartphone className="w-3.5 h-3.5 text-navy-400" />{blast.device.name}
                                </span>
                            </div>
                        )}
                        <div className="flex justify-between items-center">
                            <span className="text-navy-400">Status</span>
                            <Badge className={BLAST_BADGE[live.status] || ''}>{live.status}</Badge>
                        </div>
                        {blast.drip_enabled && (
                            <div className="flex justify-between items-center">
                                <span className="text-navy-400">Mode</span>
                                <span className="text-gold-400 text-xs font-medium">
                                    Drip{blast.daily_target ? ` · hari ini ${blast.daily_sent_count}/${blast.daily_target}` : ''}
                                </span>
                            </div>
                        )}
                        {live.status === 'scheduled' && live.scheduled_at && (
                            <div className="flex justify-between">
                                <span className="text-navy-400">Lanjut</span>
                                <span className="text-indigo-300 text-xs">{formatDate(live.scheduled_at)}</span>
                            </div>
                        )}
                        <div className="flex justify-between">
                            <span className="text-navy-400">Date</span>
                            <span className="text-white">{formatDate(blast.created_at)}</span>
                        </div>
                    </div>

                    {/* Progress bar */}
                    <div className="mt-4 pt-4 border-t border-white/5">
                        <div className="flex items-center justify-between text-xs mb-1.5">
                            <span className="text-navy-300">{isActive ? 'Mengirim…' : 'Selesai'}</span>
                            <span className="font-semibold text-white tabular-nums">{done} / {live.total} ({pct}%)</span>
                        </div>
                        <div className="h-2 rounded-full bg-navy-800 overflow-hidden">
                            <div className={`h-full rounded-full transition-all ${live.failed_count > 0 ? 'bg-gradient-to-r from-emerald-500 to-amber-500' : 'bg-emerald-500'}`} style={{ width: `${pct}%` }} />
                        </div>
                        {isActive && <p className="text-[11px] text-navy-500 mt-1.5">Diperbarui otomatis · pacing anti-ban 5–45 dtk/pesan</p>}
                    </div>

                    {/* Stats */}
                    <div className="grid grid-cols-3 gap-3 mt-4 min-w-0">
                        <div className="text-center p-3 bg-navy-800/50 rounded-xl">
                            <p className="text-xs text-navy-400">Total</p>
                            <p className="text-lg font-bold text-white">{live.total}</p>
                        </div>
                        <div className="text-center p-3 bg-navy-800/50 rounded-xl">
                            <p className="text-xs text-navy-400">Terkirim</p>
                            <p className="text-lg font-bold text-emerald-400">{live.sent_count}</p>
                        </div>
                        <div className="text-center p-3 bg-navy-800/50 rounded-xl">
                            <p className="text-xs text-navy-400">Gagal</p>
                            <p className="text-lg font-bold text-red-400">{live.failed_count}</p>
                        </div>
                    </div>
                </Card>

                {/* Message */}
                <Card className="xl:col-span-2">
                    <h3 className="text-lg font-semibold text-white mb-4">
                        Message Content
                        {blast.message_type && blast.message_type !== 'text' && (
                            <span className="ml-2 text-xs font-normal px-2 py-0.5 rounded bg-gold-500/15 text-gold-400 uppercase">{blast.message_type}</span>
                        )}
                    </h3>
                    {blast.message_type === 'image' && blast.media_url && (
                        <p className="text-xs text-navy-400 mb-2 break-all">🖼 {blast.media_url}</p>
                    )}
                    {blast.message_type === 'location' && (
                        <p className="text-xs text-navy-400 mb-2">📍 {blast.location_lat}, {blast.location_lng}</p>
                    )}
                    <div className="p-4 bg-navy-800/50 rounded-xl border border-white/5">
                        <p className="text-sm text-navy-200 whitespace-pre-wrap">{blast.message || <span className="text-navy-500 italic">(tanpa teks)</span>}</p>
                    </div>
                </Card>
            </div>

            {/* Attachment open-tracking */}
            {fileTracking && (
                <Card animate={false} className="mb-6">
                    <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl bg-gold-500/15 text-gold-400 flex items-center justify-center">
                                <FileText className="w-5 h-5" />
                            </div>
                            <div>
                                <h3 className="text-sm font-semibold text-white">{blast.blast_file?.original_name || 'Lampiran'}</h3>
                                <p className="text-xs text-navy-400">
                                    {blast.blast_file?.file_purged_at ? 'File sudah dihapus (kedaluwarsa) · riwayat buka tetap tersimpan' : 'Tautan unduh per penerima'}
                                </p>
                            </div>
                        </div>
                        <div className="text-right">
                            <p className="text-2xl font-bold text-emerald-400 tabular-nums">{fileTracking.opened}<span className="text-navy-500 text-base font-normal"> / {fileTracking.total}</span></p>
                            <p className="text-[11px] text-navy-400">sudah membuka</p>
                        </div>
                    </div>
                    <div className="flex gap-2 mb-3">
                        {[['opened', 'Sudah membuka', fileTracking.opened], ['not', 'Belum membuka', fileTracking.total - fileTracking.opened]].map(([key, label, n]) => (
                            <button key={key} type="button" onClick={() => setOpenTab(key)}
                                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition ${openTab === key ? 'bg-gold-500/20 text-gold-300 border border-gold-500/30' : 'bg-navy-800/50 text-navy-300 border border-white/5 hover:bg-white/5'}`}>
                                {label} ({n})
                            </button>
                        ))}
                    </div>
                    <div className="max-h-64 overflow-y-auto space-y-1">
                        {fileTracking.openers.filter((o) => (openTab === 'opened' ? o.opened : !o.opened)).map((o, i) => (
                            <div key={i} className="flex items-center gap-3 px-3 py-2 rounded-lg bg-navy-800/40">
                                {o.opened ? <Eye className="w-4 h-4 text-emerald-400 shrink-0" /> : <EyeOff className="w-4 h-4 text-navy-500 shrink-0" />}
                                <div className="flex-1 min-w-0">
                                    <p className="text-sm text-white truncate">{o.company || o.phone}</p>
                                    <p className="text-xs text-navy-400 font-mono">{o.channel_code ? `${o.channel_code} · ` : ''}{o.phone}</p>
                                </div>
                                {o.opened && <span className="text-[11px] text-navy-400 shrink-0">{formatDate(o.opened_at)}{o.count > 1 ? ` ·${o.count}×` : ''}</span>}
                            </div>
                        ))}
                        {fileTracking.openers.filter((o) => (openTab === 'opened' ? o.opened : !o.opened)).length === 0 && (
                            <p className="text-sm text-navy-500 text-center py-4">Tidak ada.</p>
                        )}
                    </div>
                </Card>
            )}

            {/* Recipients */}
            <Card animate={false}>
                <h3 className="text-lg font-semibold text-white mb-4">Recipients ({blast.recipients?.length || 0})</h3>
                <div className="overflow-x-auto">
                    <Table>
                        <Thead>
                            <Tr>
                                <Th>#</Th>
                                <Th>Channel</Th>
                                <Th>Phone</Th>
                                <Th>Status</Th>
                                <Th>Sent At</Th>
                                <Th>Error</Th>
                            </Tr>
                        </Thead>
                        <Tbody>
                            {blast.recipients?.map((r, i) => (
                                <Tr key={r.id}>
                                    <Td className="text-navy-400">{i + 1}</Td>
                                    <Td className="text-white font-medium">
                                        {r.channel ? `${r.channel.channel_code} - ${r.channel.company_name}` : '-'}
                                    </Td>
                                    <Td className="font-mono text-xs">{r.phone}</Td>
                                    <Td>
                                        <Badge className={RECIP_BADGE[r.status] || ''}>
                                            <span className="flex items-center gap-1">
                                                {r.status === 'sent' && <CheckCircle className="w-3 h-3" />}
                                                {r.status === 'failed' && <XCircle className="w-3 h-3" />}
                                                {r.status === 'pending' && <Clock className="w-3 h-3" />}
                                                {r.status === 'skipped' && <MinusCircle className="w-3 h-3" />}
                                                {r.status === 'cancelled' && <Ban className="w-3 h-3" />}
                                                {r.status}
                                            </span>
                                        </Badge>
                                    </Td>
                                    <Td className="text-xs">{r.sent_at ? formatDate(r.sent_at) : '-'}</Td>
                                    <Td className="text-xs text-red-400 max-w-xs truncate">{r.error || '-'}</Td>
                                </Tr>
                            ))}
                        </Tbody>
                    </Table>
                </div>
            </Card>
        </AuthenticatedLayout>
    );
}
