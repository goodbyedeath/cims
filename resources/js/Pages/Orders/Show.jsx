import { Link, router, useForm } from '@inertiajs/react';
import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import Card from '@/Components/ui/Card';
import Badge from '@/Components/ui/Badge';
import Button from '@/Components/ui/Button';
import Select from '@/Components/ui/Select';
import { Table, Thead, Tbody, Tr, Th, Td } from '@/Components/ui/Table';
import { formatCurrency, formatDate, statusColor } from '@/Lib/utils';
import { ArrowLeft, Package, CreditCard, Truck, MessageSquare, FileSpreadsheet, Copy, Check, Kanban, FileDown, Pencil } from 'lucide-react';
import { useState } from 'react';

function CopyBox({ label, icon: Icon, content, iconColor }) {
    const [copied, setCopied] = useState(false);

    const handleCopy = () => {
        navigator.clipboard.writeText(content).then(() => {
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        });
    };

    return (
        <div className="space-y-2">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <Icon className={`w-4 h-4 ${iconColor}`} />
                    <span className="text-sm font-medium text-white">{label}</span>
                </div>
                <button
                    onClick={handleCopy}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-navy-800/50 border border-white/10 text-xs text-navy-300 hover:text-white hover:bg-white/5 transition"
                >
                    {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                    {copied ? 'Copied!' : 'Copy'}
                </button>
            </div>
            <textarea
                readOnly
                value={content}
                rows={content.split('\n').length + 1}
                className="w-full px-4 py-3 bg-navy-950/60 border border-white/5 rounded-xl text-sm text-navy-200 font-mono resize-none focus:outline-none focus:ring-1 focus:ring-gold-500/20 leading-relaxed"
                onClick={(e) => e.target.select()}
            />
        </div>
    );
}

const STAGE_COLOR = { prospect: 'text-slate-400', qualified: 'text-blue-400', proposal: 'text-amber-400', negotiation: 'text-orange-400' };

export default function Show({ order, channelPipelines, bankAccounts = [] }) {
    const { data, setData, put, processing } = useForm({
        status: order.status,
        delivery_date: order.delivery_date || '',
        note: order.note || '',
    });

    const updateStatus = (e) => {
        e.preventDefault();
        put(`/orders/${order.id}`, { preserveScroll: true });
    };

    // ── Report generation ──────────────────────────────────────────

    // No. Ref stored in DB: DIS03 + ddmmyy + 3-digit daily sequence (e.g. DIS03160526001)
    const noRef = order.ref_no || '—';

    const channelName    = order.channel?.company_name || '';
    const channelAddress = [
        order.channel?.address,
        order.channel?.district,
        order.channel?.city,
        order.channel?.province,
    ].filter(Boolean).join(', ');

    // WA message — channel name once at top, one block per item, footer if needed
    const itemLines = (order.items ?? []).map((item) => {
        const spec  = item.inventory?.spesifikasi || item.inventory?.product || item.inventory?.kode_barang || '-';
        const price = formatCurrency(item.price);
        const total = formatCurrency(item.total ?? item.price * item.qty);
        return `${spec}\n${item.qty} unit\n${price}\nTotal Harga: ${total}`;
    });

    const discount    = parseFloat(order.discount) || 0;
    const multiItem   = itemLines.length > 1;
    const footerParts = [];
    if (discount > 0)            footerParts.push(`Discount: -${formatCurrency(discount)}`);
    if (discount > 0 || multiItem) footerParts.push(`Grand Total: ${formatCurrency(order.grand_total)}`);
    if (order.note)              footerParts.push(order.note);

    const blocks = [channelName, ...itemLines];
    if (footerParts.length) blocks.push(footerParts.join('\n'));

    if (order.payment_method === 'transfer' && bankAccounts.length > 0) {
        const bankLines = bankAccounts
            .map((b) => `${b.bank_name} : ${b.account_number}\n(${b.account_holder})`)
            .join('\n\n');
        blocks.push(`${bankLines}\n\nMOHON SERTAKAN BUKTI TRANSFER`);
    }

    const waText = blocks.join('\n\n');

    // Spreadsheet — tab-separated, one row per item: No.Ref, Company, Address, Kode Barang, Harga, Qty
    const sheetRows = order.items?.map((item) => {
        const kodeBarang = item.inventory?.kode_barang || '-';
        return [noRef, channelName, channelAddress, kodeBarang, item.price, item.qty].join('\t');
    }) || [];
    const sheetText = sheetRows.join('\n');

    // ──────────────────────────────────────────────────────────────

    return (
        <AuthenticatedLayout title={`Order ${order.order_no}`}>
            <div className="mb-6 flex items-center justify-between">
                <Link href="/orders" className="inline-flex items-center gap-2 text-sm text-navy-400 hover:text-white transition">
                    <ArrowLeft className="w-4 h-4" /> Back to Orders
                </Link>
                <div className="flex items-center gap-3">
                    <Link
                        href={`/orders/${order.id}/edit`}
                        className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-white/5 border border-white/10 text-navy-300 text-sm font-semibold hover:text-white hover:bg-white/10 transition"
                    >
                        <Pencil className="w-4 h-4" />
                        Edit Order
                    </Link>
                    <a
                        href={`/orders/${order.id}/pdf`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-gold-500/10 border border-gold-500/25 text-gold-400 text-sm font-semibold hover:bg-gold-500/20 hover:border-gold-500/40 transition"
                    >
                        <FileDown className="w-4 h-4" />
                        Download PDF
                    </a>
                </div>
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 mb-6">
                {/* Order Info */}
                <Card>
                    <div className="flex items-center gap-3 mb-4">
                        <Package className="w-5 h-5 text-gold-400" />
                        <h3 className="text-lg font-semibold text-white">Order Info</h3>
                    </div>
                    <div className="space-y-3 text-sm">
                        <div className="flex justify-between">
                            <span className="text-navy-400">No. Ref</span>
                            <span className="text-gold-400 font-mono font-bold">{noRef}</span>
                        </div>
                        <div className="flex justify-between">
                            <span className="text-navy-400">Order No</span>
                            <span className="text-navy-300 font-mono text-xs">{order.order_no}</span>
                        </div>
                        <div className="flex justify-between">
                            <span className="text-navy-400">Channel</span>
                            <Link href={`/channels/${order.channel?.id}`} className="text-white hover:text-gold-400 transition">
                                {order.channel?.company_name}
                            </Link>
                        </div>
                        <div className="flex justify-between">
                            <span className="text-navy-400">Sales</span>
                            <span className="text-white">{order.sales?.name}</span>
                        </div>
                        <div className="flex justify-between">
                            <span className="text-navy-400">Order Date</span>
                            <span className="text-white">{formatDate(order.order_date)}</span>
                        </div>
                        <div className="flex justify-between">
                            <span className="text-navy-400">Delivery Date</span>
                            <span className="text-white">{formatDate(order.delivery_date)}</span>
                        </div>
                        <div className="flex justify-between items-center">
                            <span className="text-navy-400">Status</span>
                            <Badge className={statusColor(order.status)}>{order.status}</Badge>
                        </div>
                    </div>

                    <form onSubmit={updateStatus} className="mt-4 pt-4 border-t border-white/5 space-y-3">
                        <Select
                            label="Update Status"
                            value={data.status}
                            onChange={(e) => setData('status', e.target.value)}
                            options={[
                                { value: 'pending', label: 'Pending' },
                                { value: 'confirmed', label: 'Confirmed' },
                                { value: 'process', label: 'Processing' },
                                { value: 'delivered', label: 'Delivered' },
                                { value: 'cancel', label: 'Cancelled' },
                            ]}
                        />
                        <Button type="submit" size="sm" disabled={processing} className="w-full">
                            <Truck className="w-4 h-4" /> Update Status
                        </Button>
                    </form>
                </Card>

                {/* Items */}
                <Card className="xl:col-span-2">
                    <h3 className="text-lg font-semibold text-white mb-4">Order Items</h3>
                    <Table>
                        <Thead>
                            <Tr>
                                <Th>Product</Th>
                                <Th>SKU</Th>
                                <Th>Qty</Th>
                                <Th>Price</Th>
                                <Th>Total</Th>
                            </Tr>
                        </Thead>
                        <Tbody>
                            {order.items?.map((item) => (
                                <Tr key={item.id}>
                                    <Td>
                                        <p className="text-white font-medium">{item.inventory?.product}</p>
                                        {item.inventory?.spesifikasi && (
                                            <p className="text-xs text-navy-400 mt-0.5 max-w-xs truncate">{item.inventory.spesifikasi}</p>
                                        )}
                                    </Td>
                                    <Td className="font-mono text-xs">{item.inventory?.sku_no}</Td>
                                    <Td>{item.qty}</Td>
                                    <Td>{formatCurrency(item.price)}</Td>
                                    <Td className="text-gold-400 font-medium">{formatCurrency(item.total)}</Td>
                                </Tr>
                            ))}
                        </Tbody>
                    </Table>

                    <div className="mt-4 pt-4 border-t border-white/5 space-y-2">
                        <div className="flex justify-between text-sm"><span className="text-navy-400">Subtotal</span><span>{formatCurrency(order.subtotal)}</span></div>
                        <div className="flex justify-between text-sm"><span className="text-navy-400">Discount</span><span className="text-red-400">-{formatCurrency(order.discount)}</span></div>
                        <div className="flex justify-between text-sm"><span className="text-navy-400">Tax</span><span>{formatCurrency(order.tax)}</span></div>
                        <div className="flex justify-between text-lg font-bold pt-2 border-t border-white/5">
                            <span>Grand Total</span><span className="text-gold-400">{formatCurrency(order.grand_total)}</span>
                        </div>
                    </div>
                </Card>
            </div>

            {/* ── Report Placeholders ─────────────────────────────────── */}
            <Card animate={false} className="mb-6">
                <div className="flex items-center gap-3 mb-5">
                    <div className="w-8 h-8 rounded-lg bg-gold-500/10 flex items-center justify-center">
                        <FileSpreadsheet className="w-4 h-4 text-gold-400" />
                    </div>
                    <div>
                        <h3 className="text-lg font-semibold text-white">Order Report</h3>
                        <p className="text-xs text-navy-400">Ref: <span className="font-mono text-gold-400">{noRef}</span></p>
                    </div>
                </div>

                <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
                    <CopyBox
                        label="WA Message"
                        icon={MessageSquare}
                        iconColor="text-emerald-400"
                        content={waText}
                    />
                    <CopyBox
                        label="Spreadsheet (paste into Excel / Google Sheets)"
                        icon={FileSpreadsheet}
                        iconColor="text-blue-400"
                        content={sheetText}
                    />
                </div>
            </Card>

            {/* Pipeline Opportunities for this Channel */}
            {channelPipelines?.length > 0 && (
                <Card animate={false} className="mb-6">
                    <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-3">
                            <Kanban className="w-5 h-5 text-gold-400" />
                            <h3 className="text-lg font-semibold text-white">Open Pipeline</h3>
                            <span className="text-xs text-navy-400">— other active deals for {order.channel?.company_name}</span>
                        </div>
                        <Link href="/pipeline" className="text-xs text-gold-400 hover:text-gold-300 transition">View Kanban →</Link>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
                        {channelPipelines.map((pl) => (
                            <div key={pl.id} className="p-3 bg-navy-800/40 border border-white/5 rounded-xl">
                                <p className="text-sm font-medium text-white truncate">{pl.title}</p>
                                <div className="flex items-center gap-2 mt-1">
                                    <span className={`text-xs capitalize ${STAGE_COLOR[pl.stage] || 'text-navy-400'}`}>{pl.stage}</span>
                                    <span className="text-[10px] text-navy-500">{pl.probability}%</span>
                                </div>
                                {pl.value && <p className="text-xs font-semibold text-gold-400 mt-1">{formatCurrency(pl.value)}</p>}
                                {pl.expected_close_date && (
                                    <p className="text-[10px] text-navy-500 mt-0.5">Close: {formatDate(pl.expected_close_date)}</p>
                                )}
                            </div>
                        ))}
                    </div>
                </Card>
            )}

            {/* Payment & Installments */}
            {order.payment && (
                <Card animate={false}>
                    <div className="flex items-center gap-3 mb-4">
                        <CreditCard className="w-5 h-5 text-gold-400" />
                        <h3 className="text-lg font-semibold text-white">Payment Details</h3>
                        <Badge className={statusColor(order.payment.payment_status)}>{order.payment.payment_status}</Badge>
                    </div>

                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                        <div className="p-3 bg-navy-800/50 rounded-xl">
                            <p className="text-xs text-navy-400">Type</p>
                            <p className="text-sm font-medium text-white capitalize">{order.payment.type_order}</p>
                        </div>
                        <div className="p-3 bg-navy-800/50 rounded-xl">
                            <p className="text-xs text-navy-400">Down Payment</p>
                            <p className="text-sm font-medium text-emerald-400">{formatCurrency(order.payment.dp)}</p>
                        </div>
                        <div className="p-3 bg-navy-800/50 rounded-xl">
                            <p className="text-xs text-navy-400">Remaining Debt</p>
                            <p className="text-sm font-medium text-red-400">{formatCurrency(order.payment.remaining_debt)}</p>
                        </div>
                        <div className="p-3 bg-navy-800/50 rounded-xl">
                            <p className="text-xs text-navy-400">Installments</p>
                            <p className="text-sm font-medium text-white">{order.payment.installment_count}x</p>
                        </div>
                    </div>

                    {order.payment.installments?.length > 0 && (
                        <Table>
                            <Thead>
                                <Tr>
                                    <Th>#</Th>
                                    <Th>Due Date</Th>
                                    <Th>Amount</Th>
                                    <Th>Status</Th>
                                    <Th>Paid Date</Th>
                                    <Th>Action</Th>
                                </Tr>
                            </Thead>
                            <Tbody>
                                {order.payment.installments.map((inst) => (
                                    <Tr key={inst.id}>
                                        <Td>{inst.installment_no}</Td>
                                        <Td>{formatDate(inst.due_date)}</Td>
                                        <Td className="font-medium">{formatCurrency(inst.amount)}</Td>
                                        <Td><Badge className={statusColor(inst.status)}>{inst.status}</Badge></Td>
                                        <Td>{formatDate(inst.paid_date)}</Td>
                                        <Td>
                                            {inst.status !== 'paid' && (
                                                <Button
                                                    size="sm"
                                                    variant="secondary"
                                                    onClick={() => router.post(`/installments/${inst.id}/pay`, { paid_date: new Date().toISOString().split('T')[0] }, { preserveScroll: true })}
                                                >
                                                    Mark Paid
                                                </Button>
                                            )}
                                        </Td>
                                    </Tr>
                                ))}
                            </Tbody>
                        </Table>
                    )}
                </Card>
            )}
        </AuthenticatedLayout>
    );
}
