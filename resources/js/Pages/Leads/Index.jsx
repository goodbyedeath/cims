import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import Card from '@/Components/ui/Card';
import Button from '@/Components/ui/Button';
import Badge from '@/Components/ui/Badge';
import { csrfHeaders } from '@/Lib/utils';
import {
    Search, MapPin, Phone, Star, Globe, Building2, Loader2,
    CheckCircle2, AlertTriangle, MessageCircle, Plus,
} from 'lucide-react';
import { useState, useEffect } from 'react';

// Search results survive navigating away and back (sessionStorage, per tab).
// 24h horizon matches the server-side result cache, so a restored session's
// "Muat lebih banyak" continues against still-cached (free) pages.
const STORAGE_KEY = 'cari-toko-state';

function loadSavedState() {
    try {
        const s = JSON.parse(sessionStorage.getItem(STORAGE_KEY) || 'null');
        if (s && Date.now() - s.ts < 24 * 3600 * 1000) return s;
    } catch { /* corrupt/unavailable storage — start fresh */ }
    return null;
}

export default function Index({ configured, provider, quota: initialQuota }) {
    const [saved] = useState(loadSavedState);
    const [quota, setQuota] = useState(initialQuota ?? saved?.quota ?? null);
    const [keyword, setKeyword] = useState(saved?.keyword ?? '');
    const [region, setRegion] = useState(saved?.region ?? '');
    const [leads, setLeads] = useState(saved?.leads ?? null);
    const [nextPageToken, setNextPageToken] = useState(saved?.nextPageToken ?? null);
    const [loading, setLoading] = useState(false);
    const [loadingMore, setLoadingMore] = useState(false);
    const [error, setError] = useState('');
    const [importing, setImporting] = useState({});   // place_id -> true
    const [imported, setImported] = useState(saved?.imported ?? {}); // place_id -> channel_code
    const [rowErrors, setRowErrors] = useState({});   // place_id -> message

    useEffect(() => {
        if (leads === null) return;
        try {
            sessionStorage.setItem(STORAGE_KEY, JSON.stringify({
                keyword, region, leads, nextPageToken, imported, quota, ts: Date.now(),
            }));
        } catch { /* storage full/unavailable — persistence is best-effort */ }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [leads, nextPageToken, imported]);

    const runSearch = async (pageToken = null) => {
        if (!keyword.trim()) return;
        pageToken ? setLoadingMore(true) : setLoading(true);
        setError('');
        try {
            const res = await fetch('/leads/search', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', Accept: 'application/json', ...csrfHeaders() },
                body: JSON.stringify({ keyword: keyword.trim(), region: region.trim() || null, pageToken }),
            });
            const json = await res.json();
            if (!res.ok || !json.ok) {
                setError(json.message || 'Pencarian gagal. Coba lagi.');
                if (!pageToken) setLeads([]);
                return;
            }
            setLeads((prev) => (pageToken && prev ? [...prev, ...json.leads] : json.leads));
            setNextPageToken(json.nextPageToken || null);
            if (json.quota) setQuota(json.quota);
        } catch {
            setError('Koneksi gagal. Coba lagi.');
        } finally {
            setLoading(false);
            setLoadingMore(false);
        }
    };

    const importLead = async (lead) => {
        setImporting((s) => ({ ...s, [lead.place_id]: true }));
        setRowErrors((s) => ({ ...s, [lead.place_id]: '' }));
        try {
            const res = await fetch('/leads/import', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', Accept: 'application/json', ...csrfHeaders() },
                body: JSON.stringify({
                    name: lead.name,
                    address: lead.address,
                    phone: lead.phone,
                    lat: lead.lat,
                    lng: lead.lng,
                    map_url: lead.map_url,
                }),
            });
            const json = await res.json();
            if (!res.ok || !json.ok) {
                setRowErrors((s) => ({ ...s, [lead.place_id]: json.message || 'Import gagal.' }));
                return;
            }
            setImported((s) => ({ ...s, [lead.place_id]: json.channel_code }));
        } catch {
            setRowErrors((s) => ({ ...s, [lead.place_id]: 'Koneksi gagal.' }));
        } finally {
            setImporting((s) => ({ ...s, [lead.place_id]: false }));
        }
    };

    return (
        <AuthenticatedLayout title="Find Prospect">
            <div className="mb-6 flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-white">Find Prospect</h1>
                    <p className="text-sm text-navy-400 mt-1">
                        Cari toko dari Google Maps berdasarkan kata kunci dan wilayah, lalu import sebagai channel prospek.
                        {provider === 'serpapi' && (
                            <span className="ml-2 inline-flex items-center px-2 py-0.5 rounded text-xs bg-navy-800/70 border border-white/10 text-navy-300">
                                via SerpApi
                            </span>
                        )}
                    </p>
                </div>
                {quota && quota.total > 0 && (() => {
                    const pct = Math.max(0, Math.min(100, Math.round((quota.left / quota.total) * 100)));
                    const barColor = pct > 30 ? 'bg-emerald-400' : pct > 10 ? 'bg-amber-400' : 'bg-red-400';
                    const textColor = pct > 30 ? 'text-emerald-400' : pct > 10 ? 'text-amber-400' : 'text-red-400';
                    return (
                        <div className="w-full sm:w-56 shrink-0 p-3 rounded-xl bg-navy-800/40 border border-white/5">
                            <div className="flex items-center justify-between text-xs mb-1.5">
                                <span className="text-navy-400">Kuota pencarian</span>
                                <span className={`font-semibold ${textColor}`}>{quota.left} / {quota.total}</span>
                            </div>
                            <div className="h-1.5 rounded-full bg-navy-900/80 overflow-hidden">
                                <div className={`h-full rounded-full ${barColor} transition-all`} style={{ width: `${pct}%` }} />
                            </div>
                            <p className="text-[11px] text-navy-500 mt-1.5">
                                Terpakai {quota.used} bulan ini — reset tiap awal bulan.
                            </p>
                        </div>
                    );
                })()}
            </div>

            {!configured && (
                <Card animate={false} className="mb-6 border-amber-500/30 bg-amber-500/5">
                    <div className="flex items-start gap-3">
                        <AlertTriangle className="w-5 h-5 text-amber-400 mt-0.5 shrink-0" />
                        <div className="text-sm text-amber-200">
                            <p className="font-semibold">API key belum dikonfigurasi.</p>
                            <p className="text-amber-200/70 mt-1">
                                Tambahkan <code className="font-mono text-xs bg-black/30 px-1.5 py-0.5 rounded">SERPAPI_KEY=...</code> (gratis,
                                daftar di serpapi.com) atau <code className="font-mono text-xs bg-black/30 px-1.5 py-0.5 rounded">GOOGLE_MAPS_API_KEY=...</code> di
                                file .env server, lalu muat ulang halaman ini.
                            </p>
                        </div>
                    </div>
                </Card>
            )}

            <Card animate={false} className="mb-6">
                <form
                    onSubmit={(e) => { e.preventDefault(); runSearch(); }}
                    className="flex flex-col sm:flex-row gap-3"
                >
                    <div className="relative flex-1">
                        <Search className="w-4 h-4 text-navy-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                        <input
                            type="text"
                            value={keyword}
                            onChange={(e) => setKeyword(e.target.value)}
                            placeholder="Kata kunci — mis. toko komputer"
                            className="w-full pl-10 pr-4 py-2.5 bg-navy-800/50 border border-white/10 rounded-lg text-white text-sm placeholder-navy-500 focus:outline-none focus:ring-2 focus:ring-gold-500/30 focus:border-gold-500/50"
                        />
                    </div>
                    <div className="relative flex-1">
                        <MapPin className="w-4 h-4 text-navy-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                        <input
                            type="text"
                            value={region}
                            onChange={(e) => setRegion(e.target.value)}
                            placeholder="Wilayah — mis. Jakarta Barat"
                            className="w-full pl-10 pr-4 py-2.5 bg-navy-800/50 border border-white/10 rounded-lg text-white text-sm placeholder-navy-500 focus:outline-none focus:ring-2 focus:ring-gold-500/30 focus:border-gold-500/50"
                        />
                    </div>
                    <Button type="submit" disabled={loading || !configured || !keyword.trim()}>
                        {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
                        {loading ? 'Mencari...' : 'Cari'}
                    </Button>
                </form>
                {error && <p className="text-sm text-red-400 mt-3">{error}</p>}
            </Card>

            {leads !== null && (
                <Card animate={false}>
                    <div className="flex items-center justify-between mb-4">
                        <h2 className="text-sm font-semibold text-navy-200">
                            {leads.length} hasil{region.trim() ? ` di ${region.trim()}` : ''}
                        </h2>
                    </div>

                    {leads.length === 0 && !loading && (
                        <p className="text-sm text-navy-400 py-8 text-center">Tidak ada hasil. Coba kata kunci atau wilayah lain.</p>
                    )}

                    <div className="space-y-3">
                        {leads.map((lead) => {
                            const doneCode = imported[lead.place_id] || lead.channel_code;
                            const already = !!lead.channel_code;
                            return (
                                <div
                                    key={lead.place_id}
                                    className="p-4 rounded-xl bg-navy-800/40 border border-white/5 hover:border-white/10 transition"
                                >
                                    <div className="flex flex-col md:flex-row md:items-start gap-3">
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2 flex-wrap">
                                                <span className="font-semibold text-white">{lead.name}</span>
                                                {lead.rating != null && (
                                                    <span className="inline-flex items-center gap-1 text-xs text-gold-400">
                                                        <Star className="w-3.5 h-3.5 fill-gold-400" />
                                                        {lead.rating} ({lead.reviews ?? 0})
                                                    </span>
                                                )}
                                                {!lead.open && <Badge variant="danger">Tutup permanen/sementara</Badge>}
                                                {doneCode && (
                                                    <Badge variant="success">
                                                        <CheckCircle2 className="w-3 h-3 mr-1" />
                                                        {already ? `Sudah channel ${doneCode}` : `Diimport — ${doneCode}`}
                                                    </Badge>
                                                )}
                                            </div>
                                            <p className="text-sm text-navy-300 mt-1">{lead.address}</p>
                                            <div className="flex items-center gap-4 mt-2 text-xs text-navy-400 flex-wrap">
                                                {lead.phone && (
                                                    <span className="inline-flex items-center gap-1.5">
                                                        <Phone className="w-3.5 h-3.5" /> {lead.phone}
                                                    </span>
                                                )}
                                                {lead.map_url && (
                                                    <a href={lead.map_url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 text-gold-400 hover:text-gold-300">
                                                        <MapPin className="w-3.5 h-3.5" /> Buka Maps
                                                    </a>
                                                )}
                                                {lead.website && (
                                                    <a href={lead.website} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 text-navy-300 hover:text-white truncate max-w-[220px]">
                                                        <Globe className="w-3.5 h-3.5 shrink-0" /> {lead.website.replace(/^https?:\/\//, '')}
                                                    </a>
                                                )}
                                            </div>
                                            {rowErrors[lead.place_id] && (
                                                <p className="text-xs text-red-400 mt-2">{rowErrors[lead.place_id]}</p>
                                            )}
                                        </div>
                                        <div className="flex items-center gap-2 shrink-0">
                                            {/* 628xx = mobile (WA-capable); 6221/6224/… = landline, no WA */}
                                            {lead.phone && lead.phone.startsWith('628') && (
                                                <a
                                                    href={`https://wa.me/${lead.phone}`}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium rounded-lg bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 border border-emerald-500/20 transition"
                                                >
                                                    <MessageCircle className="w-3.5 h-3.5" /> WA
                                                </a>
                                            )}
                                            {!doneCode && (
                                                <button
                                                    type="button"
                                                    onClick={() => importLead(lead)}
                                                    disabled={!!importing[lead.place_id]}
                                                    className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium rounded-lg bg-gold-500/10 text-gold-400 hover:bg-gold-500/20 border border-gold-500/20 transition disabled:opacity-50"
                                                >
                                                    {importing[lead.place_id]
                                                        ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                                        : <Plus className="w-3.5 h-3.5" />}
                                                    Import Channel
                                                </button>
                                            )}
                                            {doneCode && !already && (
                                                <a
                                                    href="/channels"
                                                    className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium rounded-lg bg-navy-800/50 text-navy-300 hover:text-white border border-white/10 transition"
                                                >
                                                    <Building2 className="w-3.5 h-3.5" /> Lihat Channels
                                                </a>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>

                    {nextPageToken && (
                        <div className="mt-4 text-center">
                            <Button type="button" variant="secondary" disabled={loadingMore} onClick={() => runSearch(nextPageToken)}>
                                {loadingMore ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                                {loadingMore ? 'Memuat...' : 'Muat lebih banyak'}
                            </Button>
                        </div>
                    )}
                </Card>
            )}
        </AuthenticatedLayout>
    );
}
