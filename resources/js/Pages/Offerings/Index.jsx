import { Link, router } from '@inertiajs/react';
import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import Card from '@/Components/ui/Card';
import Button from '@/Components/ui/Button';
import Select from '@/Components/ui/Select';
import Badge from '@/Components/ui/Badge';
import Pagination from '@/Components/ui/Pagination';
import { Table, Thead, Tbody, Tr, Th, ThSortable, Td } from '@/Components/ui/Table';
import { formatCurrency, formatDate, statusColor } from '@/Lib/utils';
import { Plus, Search, Eye, Pencil, Trash2, FileDown } from 'lucide-react';
import { useState } from 'react';

export default function Index({ offerings, filters }) {
    const { sort_by, sort_dir } = filters;
    const [search, setSearch] = useState(filters.search || '');

    const handleFilter = (key, value) => {
        router.get('/offerings', { ...filters, [key]: value, page: 1 }, { preserveState: true });
    };

    const handleSort = (field, dir) => {
        router.get('/offerings', { ...filters, sort_by: field, sort_dir: dir, page: 1 }, { preserveState: true });
    };

    return (
        <AuthenticatedLayout title="Offerings">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
                <div className="flex items-center gap-3 flex-wrap">
                    <form onSubmit={(e) => { e.preventDefault(); handleFilter('search', search); }} className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-navy-400" />
                        <input
                            type="text"
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            placeholder="Search offerings..."
                            className="pl-10 pr-4 py-2 bg-navy-800/50 border border-white/10 rounded-lg text-sm text-white placeholder-navy-500 focus:outline-none focus:ring-2 focus:ring-gold-500/30 w-full sm:w-64"
                        />
                    </form>
                    <Select
                        value={filters.status || ''}
                        onChange={(e) => handleFilter('status', e.target.value)}
                        placeholder="All Status"
                        options={[
                            { value: 'draft', label: 'Draft' },
                            { value: 'sent', label: 'Sent' },
                            { value: 'accepted', label: 'Accepted' },
                            { value: 'rejected', label: 'Rejected' },
                            { value: 'expired', label: 'Expired' },
                        ]}
                    />
                    <input
                        type="date"
                        value={filters.date_from || ''}
                        onChange={(e) => handleFilter('date_from', e.target.value)}
                        className="px-3 py-2 bg-navy-800/50 border border-white/10 rounded-lg text-sm text-white focus:outline-none focus:ring-2 focus:ring-gold-500/30"
                    />
                    <input
                        type="date"
                        value={filters.date_to || ''}
                        onChange={(e) => handleFilter('date_to', e.target.value)}
                        className="px-3 py-2 bg-navy-800/50 border border-white/10 rounded-lg text-sm text-white focus:outline-none focus:ring-2 focus:ring-gold-500/30"
                    />
                </div>
                <Link href="/offerings/create">
                    <Button><Plus className="w-4 h-4" /> Create Offering</Button>
                </Link>
            </div>

            <Card animate={false}>
                <Table>
                    <Thead>
                        <Tr>
                            <ThSortable field="ref_no" sort_by={sort_by} sort_dir={sort_dir} onSort={handleSort}>Ref No</ThSortable>
                            <Th>Channel</Th>
                            <Th>Sales</Th>
                            <ThSortable field="offering_date" sort_by={sort_by} sort_dir={sort_dir} onSort={handleSort}>Date</ThSortable>
                            <ThSortable field="valid_until" sort_by={sort_by} sort_dir={sort_dir} onSort={handleSort}>Valid Until</ThSortable>
                            <ThSortable field="grand_total" sort_by={sort_by} sort_dir={sort_dir} onSort={handleSort}>Grand Total</ThSortable>
                            <ThSortable field="status" sort_by={sort_by} sort_dir={sort_dir} onSort={handleSort}>Status</ThSortable>
                            <Th>Actions</Th>
                        </Tr>
                    </Thead>
                    <Tbody>
                        {offerings.data?.map((offering) => (
                            <Tr key={offering.id}>
                                <Td>
                                    <p className="font-mono text-xs font-bold text-gold-400">{offering.ref_no || '—'}</p>
                                    <p className="font-mono text-[10px] text-navy-500">{offering.offering_no}</p>
                                </Td>
                                <Td>
                                    <p className="text-white text-sm">{offering.channel?.company_name}</p>
                                    <p className="text-xs text-navy-400">{offering.channel?.channel_code}</p>
                                </Td>
                                <Td className="text-xs">{offering.sales?.name}</Td>
                                <Td className="text-xs">{formatDate(offering.offering_date)}</Td>
                                <Td className="text-xs">{formatDate(offering.valid_until)}</Td>
                                <Td className="font-medium text-gold-400">{formatCurrency(offering.grand_total)}</Td>
                                <Td><Badge className={statusColor(offering.status)}>{offering.status}</Badge></Td>
                                <Td>
                                    <div className="flex items-center gap-1">
                                        <Link href={`/offerings/${offering.id}`} className="p-1.5 rounded-lg hover:bg-white/5 text-navy-400 hover:text-white transition" title="View Detail">
                                            <Eye className="w-4 h-4" />
                                        </Link>
                                        <Link href={`/offerings/${offering.id}/edit`} className="p-1.5 rounded-lg hover:bg-blue-500/10 text-navy-400 hover:text-blue-400 transition" title="Edit Offering">
                                            <Pencil className="w-4 h-4" />
                                        </Link>
                                        <a href={`/offerings/${offering.id}/pdf`} target="_blank" rel="noopener noreferrer" className="p-1.5 rounded-lg hover:bg-gold-500/10 text-navy-400 hover:text-gold-400 transition" title="Download PDF">
                                            <FileDown className="w-4 h-4" />
                                        </a>
                                        {offering.status === 'draft' && (
                                            <button onClick={() => { if(confirm('Delete?')) router.delete(`/offerings/${offering.id}`, { preserveScroll: true }); }} className="p-1.5 rounded-lg hover:bg-red-500/10 text-navy-400 hover:text-red-400 transition">
                                                <Trash2 className="w-4 h-4" />
                                            </button>
                                        )}
                                    </div>
                                </Td>
                            </Tr>
                        ))}
                    </Tbody>
                </Table>
                <Pagination links={offerings.links} />
            </Card>
        </AuthenticatedLayout>
    );
}
