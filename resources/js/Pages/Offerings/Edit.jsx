import { useForm, Link } from '@inertiajs/react';
import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import Card from '@/Components/ui/Card';
import Input from '@/Components/ui/Input';
import SearchableSelect from '@/Components/ui/SearchableSelect';
import Button from '@/Components/ui/Button';
import Badge from '@/Components/ui/Badge';
import { ArrowLeft, Save, Plus, Trash2 } from 'lucide-react';
import { formatCurrency, statusColor } from '@/Lib/utils';

export default function Edit({ offering, channels, inventories }) {
    const { data, setData, put, processing, errors } = useForm({
        channel_id:    String(offering.channel_id),
        offering_date: offering.offering_date?.split('T')[0] ?? '',
        valid_until:   offering.valid_until?.split('T')[0] ?? '',
        discount:      parseFloat(offering.discount) || 0,
        tax_rate:      offering.tax ? Math.round((offering.tax / offering.subtotal) * 100) || 11 : 11,
        note:          offering.note || '',
        items: offering.items?.length
            ? offering.items.map((i) => ({
                inventory_id: String(i.inventory_id),
                qty:          i.qty,
                price:        parseFloat(i.price) || 0,
            }))
            : [{ inventory_id: '', qty: 1, price: 0 }],
    });

    const addItem = () => {
        setData('items', [...data.items, { inventory_id: '', qty: 1, price: 0 }]);
    };

    const removeItem = (index) => {
        if (data.items.length > 1) {
            setData('items', data.items.filter((_, i) => i !== index));
        }
    };

    const updateItem = (index, field, value) => {
        const items = [...data.items];
        items[index][field] = value;

        if (field === 'inventory_id') {
            const inv = inventories.find((i) => i.id === parseInt(value));
            items[index].price = inv ? (parseFloat(inv.m1) || parseFloat(inv.srp) || 0) : 0;
        }

        setData('items', items);
    };

    const getStock = (inventoryId) => {
        const inv = inventories.find((i) => i.id === parseInt(inventoryId));
        if (!inv) return '';
        return inv.qty === null ? 'Infinite' : inv.qty;
    };

    const subtotal   = data.items.reduce((sum, item) => sum + item.qty * item.price, 0);
    const tax        = subtotal * (data.tax_rate / 100);
    const grandTotal = subtotal - (parseFloat(data.discount) || 0) + tax;

    return (
        <AuthenticatedLayout title={`Edit Offering — ${offering.ref_no || offering.offering_no}`}>
            <div className="mb-6 flex items-center justify-between">
                <Link href={`/offerings/${offering.id}`} className="inline-flex items-center gap-2 text-sm text-navy-400 hover:text-white transition">
                    <ArrowLeft className="w-4 h-4" /> Back to Offering
                </Link>
                <div className="flex items-center gap-3">
                    <span className="font-mono text-xs text-gold-400 font-bold">{offering.ref_no}</span>
                    <Badge className={statusColor(offering.status)}>{offering.status}</Badge>
                </div>
            </div>

            <form
                onSubmit={(e) => { e.preventDefault(); put(`/offerings/${offering.id}/full`); }}
                className="space-y-6 max-w-5xl"
            >
                <Card animate={false}>
                    <h3 className="text-lg font-semibold text-white mb-4">Offering Details</h3>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                        <SearchableSelect
                            label="Channel"
                            value={data.channel_id}
                            onChange={(e) => setData('channel_id', e.target.value)}
                            placeholder="Select channel..."
                            options={channels.map((c) => ({ value: c.id, label: `${c.channel_code} - ${c.company_name}` }))}
                            error={errors.channel_id}
                        />
                        <Input label="Offering Date" type="date" value={data.offering_date} onChange={(e) => setData('offering_date', e.target.value)} error={errors.offering_date} />
                        <Input label="Valid Until" type="date" value={data.valid_until} onChange={(e) => setData('valid_until', e.target.value)} error={errors.valid_until} />
                    </div>
                </Card>

                {/* Items */}
                <Card animate={false}>
                    <div className="flex items-center justify-between mb-4">
                        <h3 className="text-lg font-semibold text-white">Offering Items</h3>
                        <Button type="button" variant="secondary" size="sm" onClick={addItem}>
                            <Plus className="w-4 h-4" /> Add Item
                        </Button>
                    </div>

                    <div className="space-y-3">
                        {data.items.map((item, index) => (
                            <div key={index} className="grid grid-cols-12 gap-3 items-end">
                                <div className="col-span-5">
                                    <SearchableSelect
                                        label={index === 0 ? 'Product (Inventory)' : undefined}
                                        value={item.inventory_id}
                                        onChange={(e) => updateItem(index, 'inventory_id', e.target.value)}
                                        placeholder="Search SKU, product, kode, spec..."
                                        options={inventories.map((inv) => ({
                                            value: inv.id,
                                            label: `${inv.sku_no} - ${inv.product}`,
                                            sub: [inv.kode_barang, inv.spesifikasi].filter(Boolean).join(' · '),
                                            searchText: [inv.kode_barang, inv.spesifikasi].filter(Boolean).join(' '),
                                        }))}
                                        error={errors[`items.${index}.inventory_id`]}
                                    />
                                </div>
                                <div className="col-span-1">
                                    <div className={index === 0 ? 'pt-6' : ''}>
                                        <span className="text-xs text-navy-400 block text-center">
                                            {item.inventory_id ? `Stok: ${getStock(item.inventory_id)}` : ''}
                                        </span>
                                    </div>
                                </div>
                                <div className="col-span-2">
                                    <Input
                                        label={index === 0 ? 'Qty' : undefined}
                                        type="number"
                                        min={1}
                                        value={item.qty}
                                        onChange={(e) => updateItem(index, 'qty', parseInt(e.target.value) || 1)}
                                        error={errors[`items.${index}.qty`]}
                                    />
                                </div>
                                <div className="col-span-2">
                                    <Input
                                        label={index === 0 ? 'Price (M1)' : undefined}
                                        type="number"
                                        value={item.price}
                                        onChange={(e) => updateItem(index, 'price', parseFloat(e.target.value) || 0)}
                                        error={errors[`items.${index}.price`]}
                                    />
                                </div>
                                <div className="col-span-1 text-right text-sm font-medium text-gold-400 pb-2">
                                    {formatCurrency(item.qty * item.price)}
                                </div>
                                <div className="col-span-1 pb-2">
                                    {data.items.length > 1 && (
                                        <button type="button" onClick={() => removeItem(index)} className="p-2 rounded-lg hover:bg-red-500/10 text-navy-400 hover:text-red-400 transition">
                                            <Trash2 className="w-4 h-4" />
                                        </button>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                </Card>

                {/* Summary */}
                <Card animate={false}>
                    <h3 className="text-lg font-semibold text-white mb-4">Summary</h3>
                    <div className="space-y-3 max-w-md ml-auto">
                        <div className="flex justify-between text-sm">
                            <span className="text-navy-300">Subtotal</span>
                            <span className="text-white">{formatCurrency(subtotal)}</span>
                        </div>
                        <div className="flex justify-between text-sm items-center gap-4">
                            <span className="text-navy-300">Discount</span>
                            <Input type="number" value={data.discount} onChange={(e) => setData('discount', parseFloat(e.target.value) || 0)} className="w-32 text-right" />
                        </div>
                        <div className="flex justify-between text-sm items-center gap-4">
                            <span className="text-navy-300">Tax (%)</span>
                            <Input type="number" value={data.tax_rate} onChange={(e) => setData('tax_rate', parseFloat(e.target.value) || 0)} className="w-32 text-right" />
                        </div>
                        <div className="flex justify-between text-sm">
                            <span className="text-navy-300">Tax Amount</span>
                            <span className="text-white">{formatCurrency(tax)}</span>
                        </div>
                        <div className="pt-3 border-t border-white/10 flex justify-between text-lg font-bold">
                            <span className="text-white">Grand Total</span>
                            <span className="text-gold-400">{formatCurrency(grandTotal)}</span>
                        </div>
                    </div>

                    <div className="mt-4 pt-4 border-t border-white/5">
                        <label className="block text-sm font-medium text-navy-200 mb-1.5">Note</label>
                        <textarea
                            value={data.note}
                            onChange={(e) => setData('note', e.target.value)}
                            rows={3}
                            className="w-full px-4 py-2 bg-navy-800/50 border border-white/10 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-gold-500/30"
                        />
                    </div>

                    <Button type="submit" disabled={processing} className="w-full mt-4">
                        <Save className="w-4 h-4" />
                        {processing ? 'Saving...' : 'Save Changes'}
                    </Button>
                </Card>
            </form>
        </AuthenticatedLayout>
    );
}
