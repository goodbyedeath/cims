import { router, useForm } from '@inertiajs/react';
import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import Card from '@/Components/ui/Card';
import Button from '@/Components/ui/Button';
import Input from '@/Components/ui/Input';
import SearchableSelect from '@/Components/ui/SearchableSelect';
import Modal from '@/Components/ui/Modal';
import Badge from '@/Components/ui/Badge';
import Pagination from '@/Components/ui/Pagination';
import { Table, Thead, Tbody, Tr, Th, ThSortable, Td } from '@/Components/ui/Table';
import { formatDate } from '@/Lib/utils';
import { Plus, Search, Eye, Trash2, ClipboardList } from 'lucide-react';
import { useState } from 'react';

const statusBadge = (status) => ({
    pending: 'bg-yellow-500/20 text-yellow-400',
    done: 'bg-emerald-500/20 text-emerald-400',
    cancelled: 'bg-red-500/20 text-red-400',
}[status] || '');

export default function Index({ requests, channels, filters }) {
    const { sort_by, sort_dir } = filters;
    const [search, setSearch] = useState(filters.search || '');
    const [showCreateModal, setShowCreateModal] = useState(false);

    const handleSort = (field, dir) => {
        router.get('/channel-requests', { ...filters, sort_by: field, sort_dir: dir, page: 1 }, { preserveState: true });
    };

    const { data, setData, post, processing, errors, reset } = useForm({
        channel_id: '',
        request: '',
    });

    const handleSearch = (e) => {
        e.preventDefault();
        router.get('/channel-requests', { ...filters, search }, { preserveState: true });
    };

    const handleFilterStatus = (status) => {
        router.get('/channel-requests', { ...filters, status }, { preserveState: true });
    };

    const handleCreate = (e) => {
        e.preventDefault();
        post('/channel-requests', {
            onSuccess: () => { setShowCreateModal(false); reset(); },
        });
    };

    return (
        <AuthenticatedLayout title="Channel Requests">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
                <div className="flex items-center gap-3">
                    <form onSubmit={handleSearch} className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-navy-400" />
                        <input
                            type="text"
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            placeholder="Search requests..."
                            className="pl-10 pr-4 py-2 bg-navy-800/50 border border-white/10 rounded-lg text-sm text-white placeholder-navy-500 focus:outline-none focus:ring-2 focus:ring-gold-500/30 w-full sm:w-64"
                        />
                    </form>
                    <div className="flex gap-1">
                        {[
                            { value: '', label: 'All' },
                            { value: 'pending', label: 'Pending' },
                            { value: 'done', label: 'Done' },
                            { value: 'cancelled', label: 'Cancelled' },
                        ].map((opt) => (
                            <button
                                key={opt.value}
                                onClick={() => handleFilterStatus(opt.value)}
                                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition ${
                                    (filters.status || '') === opt.value
                                        ? 'bg-gold-500/20 text-gold-400 border border-gold-500/30'
                                        : 'bg-navy-800/50 text-navy-400 border border-white/5 hover:bg-white/5'
                                }`}
                            >
                                {opt.label}
                            </button>
                        ))}
                    </div>
                </div>
                <Button onClick={() => setShowCreateModal(true)}>
                    <Plus className="w-4 h-4" /> New Request
                </Button>
            </div>

            <Card animate={false}>
                <Table>
                    <Thead>
                        <Tr>
                            <Th>Channel</Th>
                            <Th>Request</Th>
                            <ThSortable field="status" sort_by={sort_by} sort_dir={sort_dir} onSort={handleSort}>Status</ThSortable>
                            <Th>Requested By</Th>
                            <ThSortable field="created_at" sort_by={sort_by} sort_dir={sort_dir} onSort={handleSort}>Date</ThSortable>
                            <Th>Last Updated</Th>
                            <Th>Actions</Th>
                        </Tr>
                    </Thead>
                    <Tbody>
                        {requests.data?.length > 0 ? requests.data.map((req) => (
                            <Tr key={req.id}>
                                <Td>
                                    <p className="text-white font-medium">{req.channel?.company_name}</p>
                                    <p className="text-xs text-navy-400">{req.channel?.channel_code}</p>
                                </Td>
                                <Td className="max-w-xs">
                                    <p className="text-sm text-navy-200 truncate" title={req.request}>{req.request}</p>
                                </Td>
                                <Td>
                                    <Badge className={statusBadge(req.status)}>{req.status}</Badge>
                                </Td>
                                <Td className="text-xs">{req.user?.name}</Td>
                                <Td className="text-xs text-navy-300">{formatDate(req.created_at)}</Td>
                                <Td className="text-xs text-navy-300">{formatDate(req.updated_at)}</Td>
                                <Td>
                                    <div className="flex items-center gap-1">
                                        <button
                                            onClick={() => router.get(`/channel-requests/${req.id}`)}
                                            className="p-1.5 rounded-lg hover:bg-white/5 text-navy-400 hover:text-white transition"
                                        >
                                            <Eye className="w-4 h-4" />
                                        </button>
                                        <button
                                            onClick={() => { if (confirm('Delete this request?')) router.delete(`/channel-requests/${req.id}`, { preserveScroll: true }); }}
                                            className="p-1.5 rounded-lg hover:bg-red-500/10 text-navy-400 hover:text-red-400 transition"
                                        >
                                            <Trash2 className="w-4 h-4" />
                                        </button>
                                    </div>
                                </Td>
                            </Tr>
                        )) : (
                            <Tr>
                                <Td colSpan={7} className="text-center py-8">
                                    <ClipboardList className="w-8 h-8 text-navy-600 mx-auto mb-2" />
                                    <p className="text-navy-400">No channel requests yet</p>
                                </Td>
                            </Tr>
                        )}
                    </Tbody>
                </Table>
                <Pagination links={requests.links} />
            </Card>

            <Modal show={showCreateModal} onClose={() => setShowCreateModal(false)} title="New Channel Request" maxWidth="max-w-lg">
                <form onSubmit={handleCreate} className="space-y-4">
                    <SearchableSelect
                        label="Channel"
                        value={data.channel_id}
                        onChange={(e) => setData('channel_id', e.target.value)}
                        error={errors.channel_id}
                        placeholder="Select channel..."
                        options={channels.map((ch) => ({ value: ch.id, label: `${ch.channel_code} - ${ch.company_name}` }))}
                    />
                    <div>
                        <label className="block text-sm font-medium text-navy-200 mb-1.5">Request Details</label>
                        <textarea
                            value={data.request}
                            onChange={(e) => setData('request', e.target.value)}
                            rows={6}
                            className="w-full px-4 py-2.5 bg-navy-800/50 border border-white/10 rounded-lg text-white text-sm placeholder-navy-500 focus:outline-none focus:ring-2 focus:ring-gold-500/30"
                            placeholder="Describe the request in detail..."
                        />
                        {errors.request && <p className="text-xs text-red-400 mt-1">{errors.request}</p>}
                    </div>
                    <div className="flex gap-3 pt-2">
                        <Button type="submit" disabled={processing}>
                            {processing ? 'Submitting...' : 'Submit Request'}
                        </Button>
                        <Button type="button" variant="secondary" onClick={() => setShowCreateModal(false)}>Cancel</Button>
                    </div>
                </form>
            </Modal>
        </AuthenticatedLayout>
    );
}
