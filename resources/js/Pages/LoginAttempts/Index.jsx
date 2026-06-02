import { router, usePage } from '@inertiajs/react';
import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import Card from '@/Components/ui/Card';
import Badge from '@/Components/ui/Badge';
import Input from '@/Components/ui/Input';
import Pagination from '@/Components/ui/Pagination';
import { Table, Thead, Tbody, Tr, Th, ThSortable, Td } from '@/Components/ui/Table';
import { ShieldAlert, ShieldCheck, ShieldX, Shield, Search, RefreshCw, Monitor } from 'lucide-react';
import { useState, useCallback } from 'react';

const STATUS = {
    success: { label: 'Success',  icon: ShieldCheck, cls: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/20' },
    failed:  { label: 'Failed',   icon: ShieldX,     cls: 'bg-red-500/15 text-red-400 border-red-500/20' },
    blocked: { label: 'Blocked',  icon: ShieldAlert, cls: 'bg-amber-500/15 text-amber-400 border-amber-500/20' },
};

function StatCard({ icon: Icon, label, value, colorClass }) {
    return (
        <div className="bg-navy-800/50 border border-white/5 rounded-xl p-4 flex items-center gap-4">
            <div className={`p-2.5 rounded-xl ${colorClass}`}>
                <Icon className="w-5 h-5" />
            </div>
            <div>
                <p className="text-2xl font-bold text-white tabular-nums">{value}</p>
                <p className="text-xs text-navy-400 mt-0.5">{label}</p>
            </div>
        </div>
    );
}

function parseUA(ua) {
    if (!ua) return { browser: 'Unknown', os: 'Unknown' };
    const browser =
        /Edg\//.test(ua)    ? 'Edge'    :
        /OPR\//.test(ua)    ? 'Opera'   :
        /Chrome\//.test(ua) ? 'Chrome'  :
        /Firefox\//.test(ua)? 'Firefox' :
        /Safari\//.test(ua) ? 'Safari'  : 'Other';
    const os =
        /Windows/.test(ua)  ? 'Windows' :
        /Macintosh/.test(ua)? 'macOS'   :
        /Android/.test(ua)  ? 'Android' :
        /iPhone|iPad/.test(ua) ? 'iOS'  :
        /Linux/.test(ua)    ? 'Linux'   : 'Other';
    return { browser, os };
}

export default function Index({ attempts, stats, filters }) {
    const { sort_by, sort_dir } = filters;
    const [form, setForm] = useState({
        status: filters.status || '',
        email:  filters.email  || '',
        ip:     filters.ip     || '',
        date:   filters.date   || '',
    });

    const handleSort = (field, dir) => {
        router.get('/login-attempts', { ...filters, sort_by: field, sort_dir: dir, page: 1 }, { preserveState: true });
    };

    const applyFilters = useCallback((patch = {}) => {
        const next = { ...form, ...patch };
        setForm(next);
        const clean = Object.fromEntries(Object.entries(next).filter(([, v]) => v !== ''));
        router.get('/login-attempts', clean, { preserveState: true, replace: true });
    }, [form]);

    const clearFilters = () => {
        setForm({ status: '', email: '', ip: '', date: '' });
        router.get('/login-attempts', {}, { preserveState: true, replace: true });
    };

    const hasFilters = Object.values(form).some(Boolean);

    return (
        <AuthenticatedLayout title="Login Attempt Logs">
            <div className="space-y-5">

                {/* Stats */}
                <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
                    <StatCard icon={Shield}       label="Total Today"        value={stats.total_today}   colorClass="bg-navy-700 text-navy-300" />
                    <StatCard icon={ShieldCheck}  label="Successful Today"   value={stats.success_today} colorClass="bg-emerald-500/15 text-emerald-400" />
                    <StatCard icon={ShieldX}      label="Failed Today"       value={stats.failed_today}  colorClass="bg-red-500/15 text-red-400" />
                    <StatCard icon={ShieldAlert}  label="Blocked Today"      value={stats.blocked_today} colorClass="bg-amber-500/15 text-amber-400" />
                    <StatCard icon={Monitor}      label="Unique IPs (bad)"   value={stats.unique_ips_today} colorClass="bg-purple-500/15 text-purple-400" />
                </div>

                {/* Filters */}
                <Card animate={false}>
                    <div className="flex flex-wrap gap-3 items-end">
                        <div className="w-40">
                            <label className="block text-xs font-medium text-navy-400 mb-1">Status</label>
                            <select
                                value={form.status}
                                onChange={(e) => applyFilters({ status: e.target.value })}
                                className="w-full px-3 py-2 bg-navy-800/50 border border-white/10 rounded-lg text-sm text-white focus:outline-none focus:ring-2 focus:ring-gold-500/30"
                            >
                                <option value="">All</option>
                                <option value="success">Success</option>
                                <option value="failed">Failed</option>
                                <option value="blocked">Blocked</option>
                            </select>
                        </div>

                        <div className="flex-1 min-w-[160px]">
                            <label className="block text-xs font-medium text-navy-400 mb-1">Email</label>
                            <div className="relative">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-navy-500" />
                                <input
                                    value={form.email}
                                    onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                                    onKeyDown={(e) => e.key === 'Enter' && applyFilters()}
                                    placeholder="Filter by email…"
                                    className="w-full pl-8 pr-3 py-2 bg-navy-800/50 border border-white/10 rounded-lg text-sm text-white placeholder-navy-500 focus:outline-none focus:ring-2 focus:ring-gold-500/30"
                                />
                            </div>
                        </div>

                        <div className="flex-1 min-w-[140px]">
                            <label className="block text-xs font-medium text-navy-400 mb-1">IP Address</label>
                            <input
                                value={form.ip}
                                onChange={(e) => setForm((f) => ({ ...f, ip: e.target.value }))}
                                onKeyDown={(e) => e.key === 'Enter' && applyFilters()}
                                placeholder="Filter by IP…"
                                className="w-full px-3 py-2 bg-navy-800/50 border border-white/10 rounded-lg text-sm text-white placeholder-navy-500 focus:outline-none focus:ring-2 focus:ring-gold-500/30"
                            />
                        </div>

                        <div className="w-40">
                            <label className="block text-xs font-medium text-navy-400 mb-1">Date</label>
                            <input
                                type="date"
                                value={form.date}
                                onChange={(e) => applyFilters({ date: e.target.value })}
                                className="w-full px-3 py-2 bg-navy-800/50 border border-white/10 rounded-lg text-sm text-white focus:outline-none focus:ring-2 focus:ring-gold-500/30 [color-scheme:dark]"
                            />
                        </div>

                        <div className="flex gap-2">
                            <button
                                onClick={() => applyFilters()}
                                className="px-4 py-2 bg-gold-500/10 text-gold-400 hover:bg-gold-500/20 rounded-lg text-sm font-medium transition flex items-center gap-1.5"
                            >
                                <Search className="w-3.5 h-3.5" /> Search
                            </button>
                            {hasFilters && (
                                <button
                                    onClick={clearFilters}
                                    className="px-3 py-2 text-navy-400 hover:text-white hover:bg-white/5 rounded-lg text-sm transition flex items-center gap-1.5"
                                >
                                    <RefreshCw className="w-3.5 h-3.5" /> Clear
                                </button>
                            )}
                        </div>
                    </div>
                </Card>

                {/* Table */}
                <Card animate={false} className="p-0 overflow-hidden">
                    <div className="px-5 py-3 border-b border-white/5 flex items-center justify-between">
                        <h3 className="text-sm font-semibold text-white">
                            Login Attempts
                            <span className="ml-2 text-xs text-navy-400 font-normal">
                                {attempts.total.toLocaleString()} records
                            </span>
                        </h3>
                        <button
                            onClick={() => router.reload()}
                            className="p-1.5 rounded-lg text-navy-400 hover:text-white hover:bg-white/5 transition"
                            title="Refresh"
                        >
                            <RefreshCw className="w-4 h-4" />
                        </button>
                    </div>

                    <Table>
                        <Thead>
                            <Tr>
                                <ThSortable field="attempted_at" sort_by={sort_by} sort_dir={sort_dir} onSort={handleSort}>Time</ThSortable>
                                <ThSortable field="email" sort_by={sort_by} sort_dir={sort_dir} onSort={handleSort}>Email</ThSortable>
                                <ThSortable field="ip_address" sort_by={sort_by} sort_dir={sort_dir} onSort={handleSort}>IP Address</ThSortable>
                                <Th>Browser / OS</Th>
                                <ThSortable field="status" sort_by={sort_by} sort_dir={sort_dir} onSort={handleSort}>Status</ThSortable>
                            </Tr>
                        </Thead>
                        <Tbody>
                            {attempts.data.length === 0 ? (
                                <Tr>
                                    <Td colSpan={5} className="text-center py-10 text-navy-500">
                                        No records found.
                                    </Td>
                                </Tr>
                            ) : attempts.data.map((a) => {
                                const s = STATUS[a.status] ?? STATUS.failed;
                                const Icon = s.icon;
                                const ua = parseUA(a.user_agent);
                                return (
                                    <Tr key={a.id}>
                                        <Td className="whitespace-nowrap text-navy-300 text-xs">
                                            {new Date(a.attempted_at).toLocaleString('id-ID', {
                                                day: '2-digit', month: 'short', year: 'numeric',
                                                hour: '2-digit', minute: '2-digit', second: '2-digit',
                                            })}
                                        </Td>
                                        <Td className="font-mono text-xs">{a.email}</Td>
                                        <Td className="font-mono text-xs tabular-nums">{a.ip_address}</Td>
                                        <Td className="text-xs">
                                            <span className="text-navy-200">{ua.browser}</span>
                                            <span className="text-navy-500 mx-1">/</span>
                                            <span className="text-navy-400">{ua.os}</span>
                                        </Td>
                                        <Td>
                                            <Badge className={`${s.cls} gap-1`}>
                                                <Icon className="w-3 h-3" />
                                                {s.label}
                                            </Badge>
                                        </Td>
                                    </Tr>
                                );
                            })}
                        </Tbody>
                    </Table>

                    {attempts.last_page > 1 && (
                        <div className="px-5 py-3 border-t border-white/5">
                            <Pagination links={attempts.links} />
                        </div>
                    )}
                </Card>

            </div>
        </AuthenticatedLayout>
    );
}
