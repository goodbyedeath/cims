import { Link, router } from '@inertiajs/react';
import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import Card from '@/Components/ui/Card';
import Select from '@/Components/ui/Select';
import Badge from '@/Components/ui/Badge';
import Pagination from '@/Components/ui/Pagination';
import { Table, Thead, Tbody, Tr, Th, ThSortable, Td } from '@/Components/ui/Table';
import { formatCurrency, statusColor } from '@/Lib/utils';
import { Search, Eye, AlertTriangle } from 'lucide-react';
import { useState } from 'react';

function InstallmentSummary({ installments }) {
    if (!installments?.length) return null;

    const paid = installments.filter((i) => i.status === 'paid').length;
    const late = installments.filter((i) => i.status === 'late').length;
    const total = installments.length;

    return (
        <div className="flex flex-col gap-0.5">
            <span className="text-xs text-navy-300">
                {paid}/{total} paid
            </span>
            {late > 0 && (
                <span className="text-xs text-orange-400 font-medium flex items-center gap-1">
                    <AlertTriangle className="w-3 h-3" />
                    {late} overdue
                </span>
            )}
        </div>
    );
}

export default function Index({ payments, filters }) {
    const { sort_by, sort_dir } = filters;
    const [search, setSearch] = useState(filters.search || '');

    const handleFilter = (key, value) => {
        router.get('/payments', { ...filters, [key]: value, page: 1 }, { preserveState: true });
    };

    const handleSort = (field, dir) => {
        router.get('/payments', { ...filters, sort_by: field, sort_dir: dir, page: 1 }, { preserveState: true });
    };

    const toggleOverdue = () => {
        handleFilter('overdue', filters.overdue === '1' ? '' : '1');
    };

    return (
        <AuthenticatedLayout title="Payments">
            <div className="flex items-center gap-3 flex-wrap mb-6">
                <form onSubmit={(e) => { e.preventDefault(); handleFilter('search', search); }} className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-navy-400" />
                    <input
                        type="text"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        placeholder="Search by order or channel..."
                        className="pl-10 pr-4 py-2 bg-navy-800/50 border border-white/10 rounded-lg text-sm text-white placeholder-navy-500 focus:outline-none focus:ring-2 focus:ring-gold-500/30 w-72"
                    />
                </form>
                <Select
                    value={filters.status || ''}
                    onChange={(e) => handleFilter('status', e.target.value)}
                    placeholder="All Status"
                    options={[
                        { value: 'unpaid', label: 'Unpaid' },
                        { value: 'partial', label: 'Partial' },
                        { value: 'paid', label: 'Paid' },
                        { value: 'cancelled', label: 'Cancelled' },
                    ]}
                />
                <Select
                    value={filters.type || ''}
                    onChange={(e) => handleFilter('type', e.target.value)}
                    placeholder="All Types"
                    options={[
                        { value: 'cash', label: 'Cash' },
                        { value: 'installment', label: 'Installment' },
                    ]}
                />
                {/* Overdue toggle */}
                <button
                    onClick={toggleOverdue}
                    className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm border transition ${
                        filters.overdue === '1'
                            ? 'bg-orange-500/20 border-orange-500/40 text-orange-300'
                            : 'bg-navy-800/50 border-white/10 text-navy-400 hover:text-white hover:bg-white/5'
                    }`}
                >
                    <AlertTriangle className="w-3.5 h-3.5" />
                    Overdue Only
                </button>
            </div>

            <Card animate={false}>
                <Table>
                    <Thead>
                        <Tr>
                            <Th>Order</Th>
                            <Th>Channel</Th>
                            <ThSortable field="type_order" sort_by={sort_by} sort_dir={sort_dir} onSort={handleSort}>Type</ThSortable>
                            <Th>Total</Th>
                            <Th>DP</Th>
                            <Th>Remaining</Th>
                            <Th>Installments</Th>
                            <ThSortable field="payment_status" sort_by={sort_by} sort_dir={sort_dir} onSort={handleSort}>Status</ThSortable>
                            <Th>Actions</Th>
                        </Tr>
                    </Thead>
                    <Tbody>
                        {payments.data?.map((payment) => {
                            const hasLate      = payment.installments?.some((i) => i.status === 'late');
                            const orderExists  = !!payment.order?.id;
                            const orderDeleted = orderExists && !!payment.order?.deleted_at;
                            const isCancelled  = payment.payment_status === 'cancelled';
                            return (
                                <Tr key={payment.id} className={[
                                    hasLate     ? 'border-l-2 border-l-orange-500/50' : '',
                                    isCancelled ? 'opacity-50' : '',
                                ].join(' ')}>
                                    <Td>
                                        {orderExists ? (
                                            <div className="flex flex-col gap-0.5">
                                                {orderDeleted ? (
                                                    <span className="font-mono text-xs text-navy-400 line-through">
                                                        {payment.order.order_no}
                                                    </span>
                                                ) : (
                                                    <Link href={`/orders/${payment.order.id}`} className="text-gold-400 hover:text-gold-300 font-mono text-xs">
                                                        {payment.order.order_no}
                                                    </Link>
                                                )}
                                                {orderDeleted && (
                                                    <span className="text-[10px] text-red-400/80 font-medium">order deleted</span>
                                                )}
                                            </div>
                                        ) : (
                                            <span className="text-navy-500 text-xs font-mono">—</span>
                                        )}
                                    </Td>
                                    <Td className="text-white text-sm">{payment.order?.channel?.company_name || '—'}</Td>
                                    <Td className="capitalize text-xs">{payment.type_order}</Td>
                                    <Td className="font-medium">{formatCurrency(payment.order?.grand_total)}</Td>
                                    <Td className="text-emerald-400">{formatCurrency(payment.dp)}</Td>
                                    <Td className="text-red-400">{formatCurrency(payment.remaining_debt)}</Td>
                                    <Td>
                                        <InstallmentSummary installments={payment.installments} />
                                    </Td>
                                    <Td>
                                        <div className="flex flex-col gap-1">
                                            <Badge className={statusColor(payment.payment_status)}>{payment.payment_status}</Badge>
                                            {hasLate && (
                                                <Badge className="bg-orange-500/20 text-orange-300 text-[10px]">overdue</Badge>
                                            )}
                                        </div>
                                    </Td>
                                    <Td>
                                        {orderExists && !orderDeleted ? (
                                            <Link href={`/orders/${payment.order.id}`} className="p-1.5 rounded-lg hover:bg-white/5 text-navy-400 hover:text-white transition inline-flex">
                                                <Eye className="w-4 h-4" />
                                            </Link>
                                        ) : (
                                            <span className="p-1.5 inline-flex text-navy-700 cursor-not-allowed" title="Order deleted">
                                                <Eye className="w-4 h-4" />
                                            </span>
                                        )}
                                    </Td>
                                </Tr>
                            );
                        })}
                    </Tbody>
                </Table>
                <Pagination links={payments.links} />
            </Card>
        </AuthenticatedLayout>
    );
}
