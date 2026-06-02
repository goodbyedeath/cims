import { Link, router } from '@inertiajs/react';
import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import Card from '@/Components/ui/Card';
import Button from '@/Components/ui/Button';
import Select from '@/Components/ui/Select';
import Badge from '@/Components/ui/Badge';
import Pagination from '@/Components/ui/Pagination';
import { Table, Thead, Tbody, Tr, Th, ThSortable, Td } from '@/Components/ui/Table';
import { formatCurrency, formatDate, statusColor } from '@/Lib/utils';
import { Plus, Search, Eye, Trash2, FileDown } from 'lucide-react';
import { useState } from 'react';

export default function Index({ orders, filters }) {
    const { sort_by, sort_dir } = filters;
    const [search, setSearch] = useState(filters.search || '');

    const handleFilter = (key, value) => {
        router.get('/orders', { ...filters, [key]: value, page: 1 }, { preserveState: true });
    };

    const handleSort = (field, dir) => {
        router.get('/orders', { ...filters, sort_by: field, sort_dir: dir, page: 1 }, { preserveState: true });
    };

    return (
        <AuthenticatedLayout title="Orders">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
                <div className="flex items-center gap-3 flex-wrap">
                    <form onSubmit={(e) => { e.preventDefault(); handleFilter('search', search); }} className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-navy-400" />
                        <input
                            type="text"
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            placeholder="Search orders..."
                            className="pl-10 pr-4 py-2 bg-navy-800/50 border border-white/10 rounded-lg text-sm text-white placeholder-navy-500 focus:outline-none focus:ring-2 focus:ring-gold-500/30 w-full sm:w-64"
                        />
                    </form>
                    <Select
                        value={filters.status || ''}
                        onChange={(e) => handleFilter('status', e.target.value)}
                        placeholder="All Status"
                        options={[
                            { value: 'pending', label: 'Pending' },
                            { value: 'confirmed', label: 'Confirmed' },
                            { value: 'process', label: 'Processing' },
                            { value: 'delivered', label: 'Delivered' },
                            { value: 'cancel', label: 'Cancelled' },
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
                <Link href="/orders/create">
                    <Button><Plus className="w-4 h-4" /> Create Order</Button>
                </Link>
            </div>

            <Card animate={false}>
                <Table>
                    <Thead>
                        <Tr>
                            <ThSortable field="order_no" sort_by={sort_by} sort_dir={sort_dir} onSort={handleSort}>No. Ref</ThSortable>
                            <Th>Channel</Th>
                            <Th>Sales</Th>
                            <ThSortable field="order_date" sort_by={sort_by} sort_dir={sort_dir} onSort={handleSort}>Date</ThSortable>
                            <ThSortable field="grand_total" sort_by={sort_by} sort_dir={sort_dir} onSort={handleSort}>Amount</ThSortable>
                            <Th>Payment</Th>
                            <ThSortable field="status" sort_by={sort_by} sort_dir={sort_dir} onSort={handleSort}>Status</ThSortable>
                            <Th>Actions</Th>
                        </Tr>
                    </Thead>
                    <Tbody>
                        {orders.data?.map((order) => (
                            <Tr key={order.id}>
                                <Td>
                                    <p className="font-mono text-xs font-bold text-gold-400">{order.ref_no || '—'}</p>
                                    <p className="font-mono text-[10px] text-navy-500">{order.order_no}</p>
                                </Td>
                                <Td>
                                    <p className="text-white text-sm">{order.channel?.company_name}</p>
                                    <p className="text-xs text-navy-400">{order.channel?.channel_code}</p>
                                </Td>
                                <Td className="text-xs">{order.sales?.name}</Td>
                                <Td className="text-xs">{formatDate(order.order_date)}</Td>
                                <Td className="font-medium text-gold-400">{formatCurrency(order.grand_total)}</Td>
                                <Td>
                                    {order.payment && (
                                        <Badge className={statusColor(order.payment.payment_status)}>
                                            {order.payment.payment_status}
                                        </Badge>
                                    )}
                                </Td>
                                <Td><Badge className={statusColor(order.status)}>{order.status}</Badge></Td>
                                <Td>
                                    <div className="flex items-center gap-1">
                                        <Link href={`/orders/${order.id}`} className="p-1.5 rounded-lg hover:bg-white/5 text-navy-400 hover:text-white transition" title="View Detail">
                                            <Eye className="w-4 h-4" />
                                        </Link>
                                        <a href={`/orders/${order.id}/pdf`} target="_blank" rel="noopener noreferrer" className="p-1.5 rounded-lg hover:bg-gold-500/10 text-navy-400 hover:text-gold-400 transition" title="Download PDF">
                                            <FileDown className="w-4 h-4" />
                                        </a>
                                        {order.status === 'pending' && (
                                            <button onClick={() => { if(confirm('Delete?')) router.delete(`/orders/${order.id}`, { preserveScroll: true }); }} className="p-1.5 rounded-lg hover:bg-red-500/10 text-navy-400 hover:text-red-400 transition">
                                                <Trash2 className="w-4 h-4" />
                                            </button>
                                        )}
                                    </div>
                                </Td>
                            </Tr>
                        ))}
                    </Tbody>
                </Table>
                <Pagination links={orders.links} />
            </Card>
        </AuthenticatedLayout>
    );
}
