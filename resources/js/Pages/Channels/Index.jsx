import { Link, router } from '@inertiajs/react';
import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import Card from '@/Components/ui/Card';
import Button from '@/Components/ui/Button';
import Input from '@/Components/ui/Input';
import Select from '@/Components/ui/Select';
import Badge from '@/Components/ui/Badge';
import Pagination from '@/Components/ui/Pagination';
import { Table, Thead, Tbody, Tr, Th, ThSortable, Td } from '@/Components/ui/Table';
import { formatNumber, gradeColor, statusColor } from '@/Lib/utils';
import Modal from '@/Components/ui/Modal';
import { Plus, Search, Eye, Edit, Trash2, Upload, AlertTriangle, RefreshCw, MapPin, CheckCircle2, Loader2, MailX, Mail, BellOff, BellRing } from 'lucide-react';
import { useState, useRef } from 'react';

export default function Index({ channels, filters, provinces, hasGoogleSheet, noCoordsCount }) {
    const { sort_by, sort_dir } = filters;
    const [search, setSearch] = useState(filters.search || '');
    const [importing, setImporting] = useState(false);
    const [syncing, setSyncing] = useState(false);
    const [showDeleteAll, setShowDeleteAll] = useState(false);
    const [deletePassword, setDeletePassword] = useState('');
    const [deleteError, setDeleteError] = useState('');
    const [deleting, setDeleting] = useState(false);
    // Optimistic map for email_invalid toggle: { [channelId]: bool }
    const [emailInvalidMap, setEmailInvalidMap] = useState({});

    const toggleEmailInvalid = async (ch) => {
        const csrf  = document.querySelector('meta[name="csrf-token"]')?.getAttribute('content');
        const cur   = emailInvalidMap[ch.id] ?? ch.email_invalid;
        setEmailInvalidMap(prev => ({ ...prev, [ch.id]: !cur }));
        try {
            await fetch(`/channels/${ch.id}/toggle-email-invalid`, {
                method: 'POST',
                headers: { 'X-CSRF-TOKEN': csrf, 'Accept': 'application/json' },
            });
        } catch {
            setEmailInvalidMap(prev => ({ ...prev, [ch.id]: cur }));
        }
    };

    // Optimistic map for email_unsubscribed toggle: { [channelId]: bool }
    const [unsubscribedMap, setUnsubscribedMap] = useState({});

    const toggleUnsubscribed = async (ch) => {
        const csrf = document.querySelector('meta[name="csrf-token"]')?.getAttribute('content');
        const cur  = unsubscribedMap[ch.id] ?? ch.email_unsubscribed;
        setUnsubscribedMap(prev => ({ ...prev, [ch.id]: !cur }));
        try {
            await fetch(`/channels/${ch.id}/toggle-unsubscribed`, {
                method: 'POST',
                headers: { 'X-CSRF-TOKEN': csrf, 'Accept': 'application/json' },
            });
        } catch {
            setUnsubscribedMap(prev => ({ ...prev, [ch.id]: cur }));
        }
    };
    const fileInputRef = useRef(null);

    // Bulk geocode state
    const [showGeocode, setShowGeocode] = useState(false);
    const [geocoding, setGeocoding] = useState(false);
    const [geoStats, setGeoStats] = useState({ updated: 0, skipped: 0, remaining: noCoordsCount, done: false });
    const [geoTotal, setGeoTotal] = useState(noCoordsCount);
    const geocodingRef = useRef(false);

    const startBulkGeocode = async () => {
        setGeocoding(true);
        geocodingRef.current = true;
        setGeoStats({ updated: 0, skipped: 0, remaining: noCoordsCount, done: false });
        setGeoTotal(noCoordsCount);

        const csrf = document.querySelector('meta[name="csrf-token"]')?.getAttribute('content');
        let totalUpdated = 0;
        let totalSkipped = 0;
        let noProgressStreak = 0; // consecutive batches with zero updates

        while (geocodingRef.current) {
            let prevRemaining;
            try {
                const res = await fetch('/channels-bulk-geocode', {
                    method: 'POST',
                    headers: { 'X-CSRF-TOKEN': csrf, 'Accept': 'application/json' },
                });
                const data = await res.json();

                totalUpdated += data.updated;
                totalSkipped += data.skipped;

                setGeoStats({
                    updated: totalUpdated,
                    skipped: totalSkipped,
                    remaining: data.remaining,
                    done: data.done,
                });

                if (data.done) break;

                // Stop only after 2 consecutive zero-progress batches to avoid
                // premature termination on the very first batch
                if (data.updated === 0) {
                    noProgressStreak++;
                    if (noProgressStreak >= 2) break;
                } else {
                    noProgressStreak = 0;
                }

                prevRemaining = data.remaining;
            } catch {
                break;
            }
        }

        geocodingRef.current = false;
        setGeocoding(false);
        setGeoStats((s) => ({ ...s, done: true }));
    };

    const stopGeocode = () => {
        geocodingRef.current = false;
    };

    const handleFilter = (key, value) => {
        router.get('/channels', { ...filters, [key]: value, page: 1 }, { preserveState: true });
    };

    const handleSort = (field, dir) => {
        router.get('/channels', { ...filters, sort_by: field, sort_dir: dir, page: 1 }, { preserveState: true });
    };

    const handleSearch = (e) => {
        e.preventDefault();
        handleFilter('search', search);
    };

    const handleDelete = (id) => {
        if (confirm('Are you sure you want to delete this channel?')) {
            router.delete(`/channels/${id}`, { preserveScroll: true });
        }
    };

    const handleDeleteAll = () => {
        setDeleting(true);
        setDeleteError('');
        router.post('/channels-destroy-all', { password: deletePassword }, {
            preserveScroll: true,
            onSuccess: () => { setShowDeleteAll(false); setDeletePassword(''); },
            onError: (errors) => { setDeleteError(errors.password || 'Gagal menghapus.'); },
            onFinish: () => setDeleting(false),
        });
    };

    const handleImport = (e) => {
        const file = e.target.files[0];
        if (!file) return;
        setImporting(true);
        router.post('/channels-import', { file }, {
            forceFormData: true,
            preserveScroll: true,
            onFinish: () => { setImporting(false); if (fileInputRef.current) fileInputRef.current.value = ''; },
        });
    };

    return (
        <AuthenticatedLayout title="Channels">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
                <div className="flex items-center gap-3 flex-wrap">
                    <form onSubmit={handleSearch} className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-navy-400" />
                        <input
                            type="text"
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            placeholder="Search channels..."
                            className="pl-10 pr-4 py-2 bg-navy-800/50 border border-white/10 rounded-lg text-sm text-white placeholder-navy-500 focus:outline-none focus:ring-2 focus:ring-gold-500/30 w-full sm:w-64"
                        />
                    </form>
                    <Select
                        value={filters.status || ''}
                        onChange={(e) => handleFilter('status', e.target.value)}
                        placeholder="All Status"
                        options={[
                            { value: 'active', label: 'Active' },
                            { value: 'inactive', label: 'Inactive' },
                            { value: 'blacklist', label: 'Blacklist' },
                        ]}
                    />
                    <Select
                        value={filters.grade || ''}
                        onChange={(e) => handleFilter('grade', e.target.value)}
                        placeholder="All Grades"
                        options={[
                            { value: 'platinum', label: 'Platinum' },
                            { value: 'gold', label: 'Gold' },
                            { value: 'silver', label: 'Silver' },
                            { value: 'risk', label: 'Risk' },
                        ]}
                    />
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                    <Button variant="secondary" onClick={() => setShowDeleteAll(true)} className="!text-red-400 !border-red-500/20 hover:!bg-red-500/10">
                        <Trash2 className="w-4 h-4" /> Remove All
                    </Button>
                    <input type="file" ref={fileInputRef} accept=".xlsx,.xls" onChange={handleImport} className="hidden" />
                    <Button variant="secondary" onClick={() => fileInputRef.current?.click()} disabled={importing}>
                        <Upload className="w-4 h-4" /> {importing ? 'Importing...' : 'Import XLSX'}
                    </Button>
                    {hasGoogleSheet && (
                        <Button
                            variant="secondary"
                            disabled={syncing}
                            onClick={() => {
                                setSyncing(true);
                                router.post('/channels-sync-google-sheet', {}, {
                                    preserveScroll: true,
                                    onFinish: () => setSyncing(false),
                                });
                            }}
                        >
                            <RefreshCw className={`w-4 h-4 ${syncing ? 'animate-spin' : ''}`} />
                            {syncing ? 'Syncing...' : 'Sync Google Sheet'}
                        </Button>
                    )}
                    {noCoordsCount > 0 && (
                        <Button variant="secondary" onClick={() => setShowGeocode(true)}>
                            <MapPin className="w-4 h-4" /> Update Coordinates
                            <span className="ml-1 px-1.5 py-0.5 text-[10px] font-bold bg-gold-500/20 text-gold-400 rounded-full">{noCoordsCount}</span>
                        </Button>
                    )}
                    <Link href="/channels/create">
                        <Button><Plus className="w-4 h-4" /> Add Channel</Button>
                    </Link>
                </div>
            </div>

            <Card animate={false}>
                <Table>
                    <Thead>
                        <Tr>
                            <ThSortable field="channel_code" sort_by={sort_by} sort_dir={sort_dir} onSort={handleSort}>Code</ThSortable>
                            <ThSortable field="company_name" sort_by={sort_by} sort_dir={sort_dir} onSort={handleSort}>Company</ThSortable>
                            <Th>Location</Th>
                            <ThSortable field="performance_score" sort_by={sort_by} sort_dir={sort_dir} onSort={handleSort}>Score</ThSortable>
                            <Th>Grade</Th>
                            <Th>Orders</Th>
                            <ThSortable field="status" sort_by={sort_by} sort_dir={sort_dir} onSort={handleSort}>Status</ThSortable>
                            <Th>Actions</Th>
                        </Tr>
                    </Thead>
                    <Tbody>
                        {channels.data?.map((ch) => (
                            <Tr key={ch.id}>
                                <Td className="font-mono text-xs text-gold-400">{ch.channel_code}</Td>
                                <Td>
                                    <div>
                                        <p className="font-medium text-white">{ch.company_name}</p>
                                        <p className="text-xs text-navy-400">{ch.gender === 'female' ? 'Bu' : 'Pak'} {ch.owner_name}</p>
                                        {(emailInvalidMap[ch.id] ?? ch.email_invalid) && (
                                            <span className="inline-flex items-center gap-1 mt-0.5 text-[10px] font-medium text-red-400">
                                                <MailX className="w-3 h-3" /> Email invalid
                                            </span>
                                        )}
                                        {(unsubscribedMap[ch.id] ?? ch.email_unsubscribed) && (
                                            <span className="inline-flex items-center gap-1 mt-0.5 text-[10px] font-medium text-amber-400">
                                                <BellOff className="w-3 h-3" /> Unsubscribed
                                            </span>
                                        )}
                                    </div>
                                </Td>
                                <Td className="text-xs">{ch.city}, {ch.province}</Td>
                                <Td className="font-semibold text-gold-400">{ch.performance_score}</Td>
                                <Td><Badge className={gradeColor(ch.channel_grade)}>{ch.channel_grade}</Badge></Td>
                                <Td>
                                    <div className="text-xs space-y-0.5">
                                        <p className="text-emerald-400">{ch.successful_order} delivered</p>
                                        <p className="text-yellow-400">{ch.pending_order} pending</p>
                                    </div>
                                </Td>
                                <Td><Badge className={statusColor(ch.status)}>{ch.status}</Badge></Td>
                                <Td>
                                    <div className="flex items-center gap-1">
                                        <Link href={`/channels/${ch.id}`} className="p-1.5 rounded-lg hover:bg-white/5 text-navy-400 hover:text-white transition">
                                            <Eye className="w-4 h-4" />
                                        </Link>
                                        <Link href={`/channels/${ch.id}/edit`} className="p-1.5 rounded-lg hover:bg-white/5 text-navy-400 hover:text-white transition">
                                            <Edit className="w-4 h-4" />
                                        </Link>
                                        {/* Email invalid toggle — mark bounced/bad addresses */}
                                        <button
                                            onClick={() => toggleEmailInvalid(ch)}
                                            title={(emailInvalidMap[ch.id] ?? ch.email_invalid) ? 'Mark email as valid' : 'Mark email as invalid (bounced)'}
                                            className={`p-1.5 rounded-lg transition ${
                                                (emailInvalidMap[ch.id] ?? ch.email_invalid)
                                                    ? 'text-red-400 bg-red-500/10 hover:bg-red-500/20'
                                                    : 'text-navy-400 hover:text-orange-400 hover:bg-orange-500/10'
                                            }`}
                                        >
                                            {(emailInvalidMap[ch.id] ?? ch.email_invalid)
                                                ? <MailX className="w-4 h-4" />
                                                : <Mail className="w-4 h-4" />
                                            }
                                        </button>
                                        {/* Unsubscribe toggle — channel opted out or admin override */}
                                        <button
                                            onClick={() => toggleUnsubscribed(ch)}
                                            title={(unsubscribedMap[ch.id] ?? ch.email_unsubscribed) ? 'Re-subscribe to email blasts' : 'Unsubscribe from email blasts'}
                                            className={`p-1.5 rounded-lg transition ${
                                                (unsubscribedMap[ch.id] ?? ch.email_unsubscribed)
                                                    ? 'text-amber-400 bg-amber-500/10 hover:bg-amber-500/20'
                                                    : 'text-navy-400 hover:text-amber-400 hover:bg-amber-500/10'
                                            }`}
                                        >
                                            {(unsubscribedMap[ch.id] ?? ch.email_unsubscribed)
                                                ? <BellOff className="w-4 h-4" />
                                                : <BellRing className="w-4 h-4" />
                                            }
                                        </button>
                                        <button onClick={() => handleDelete(ch.id)} className="p-1.5 rounded-lg hover:bg-red-500/10 text-navy-400 hover:text-red-400 transition">
                                            <Trash2 className="w-4 h-4" />
                                        </button>
                                    </div>
                                </Td>
                            </Tr>
                        ))}
                    </Tbody>
                </Table>
                <Pagination links={channels.links} />
            </Card>
            {/* Bulk Geocode Modal */}
            <Modal show={showGeocode} onClose={() => { if (!geocoding) { setShowGeocode(false); router.reload({ only: ['noCoordsCount'] }); } }} title="Update Channel Coordinates" maxWidth="max-w-md">
                <div className="space-y-5">
                    <p className="text-sm text-navy-300">
                        Automatically fills latitude & longitude for all channels that have a city but no coordinates yet.
                        Channels without a city are skipped.
                    </p>

                    {/* Stats */}
                    <div className="grid grid-cols-3 gap-3 text-center">
                        <div className="p-3 bg-navy-800/50 rounded-xl">
                            <p className="text-lg font-bold text-emerald-400">{geoStats.updated}</p>
                            <p className="text-xs text-navy-400">Updated</p>
                        </div>
                        <div className="p-3 bg-navy-800/50 rounded-xl">
                            <p className="text-lg font-bold text-yellow-400">{geoStats.skipped}</p>
                            <p className="text-xs text-navy-400">Not Found</p>
                        </div>
                        <div className="p-3 bg-navy-800/50 rounded-xl">
                            <p className="text-lg font-bold text-navy-300">{geoStats.remaining}</p>
                            <p className="text-xs text-navy-400">Remaining</p>
                        </div>
                    </div>

                    {/* Progress bar */}
                    {geoTotal > 0 && (
                        <div>
                            <div className="flex justify-between text-xs text-navy-400 mb-1.5">
                                <span>Progress</span>
                                <span>{geoTotal - geoStats.remaining} / {geoTotal}</span>
                            </div>
                            <div className="w-full h-2 bg-navy-800 rounded-full overflow-hidden">
                                <div
                                    className="h-full bg-gradient-to-r from-gold-500 to-emerald-500 rounded-full transition-all duration-500"
                                    style={{ width: `${geoTotal > 0 ? Math.round(((geoTotal - geoStats.remaining) / geoTotal) * 100) : 0}%` }}
                                />
                            </div>
                        </div>
                    )}

                    {/* Status message */}
                    {geocoding && (
                        <p className="text-xs text-navy-400 flex items-center gap-2">
                            <Loader2 className="w-3.5 h-3.5 animate-spin shrink-0" />
                            Processing batch... each city takes ~1 second to geocode.
                        </p>
                    )}
                    {geoStats.done && !geocoding && (
                        <p className="text-xs text-emerald-400 flex items-center gap-2">
                            <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                            Done! {geoStats.updated} channels updated.
                            {geoStats.remaining > 0 && ` ${geoStats.remaining} channels could not be geocoded (city not recognised by Nominatim).`}
                        </p>
                    )}

                    <div className="flex justify-end gap-2 pt-1">
                        {geocoding ? (
                            <Button variant="secondary" onClick={stopGeocode}>
                                Stop
                            </Button>
                        ) : geoStats.done ? (
                            <Button onClick={() => { setShowGeocode(false); router.reload({ only: ['noCoordsCount'] }); }}>
                                <CheckCircle2 className="w-4 h-4" /> Close
                            </Button>
                        ) : (
                            <>
                                <Button variant="secondary" onClick={() => setShowGeocode(false)}>Cancel</Button>
                                <Button onClick={startBulkGeocode}>
                                    <MapPin className="w-4 h-4" /> Start Geocoding
                                </Button>
                            </>
                        )}
                    </div>
                </div>
            </Modal>

            <Modal show={showDeleteAll} onClose={() => { setShowDeleteAll(false); setDeletePassword(''); setDeleteError(''); }} title="Remove All Channels" maxWidth="max-w-md">
                <div className="space-y-4">
                    <div className="flex items-start gap-3 p-3 bg-red-500/10 border border-red-500/20 rounded-lg">
                        <AlertTriangle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
                        <p className="text-sm text-red-300">Semua data channel akan dihapus permanen. Masukkan password Anda untuk konfirmasi.</p>
                    </div>
                    <Input
                        label="Password"
                        type="password"
                        value={deletePassword}
                        onChange={(e) => setDeletePassword(e.target.value)}
                        error={deleteError}
                        placeholder="Masukkan password Anda"
                    />
                    <div className="flex justify-end gap-2">
                        <Button variant="secondary" onClick={() => { setShowDeleteAll(false); setDeletePassword(''); setDeleteError(''); }}>
                            Batal
                        </Button>
                        <Button onClick={handleDeleteAll} disabled={deleting || !deletePassword} className="!bg-red-500/20 !text-red-400 hover:!bg-red-500/30">
                            <Trash2 className="w-4 h-4" /> {deleting ? 'Menghapus...' : 'Hapus Semua'}
                        </Button>
                    </div>
                </div>
            </Modal>
        </AuthenticatedLayout>
    );
}
