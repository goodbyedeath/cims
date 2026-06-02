import { useForm, router } from '@inertiajs/react';
import { useRef, useState } from 'react';
import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import Card from '@/Components/ui/Card';
import Input from '@/Components/ui/Input';
import Button from '@/Components/ui/Button';
import { Building2, Upload, Trash2, Image as ImageIcon, Save, FileText, Sparkles, Mail, Landmark, Plus } from 'lucide-react';

function getInitials(name) {
    if (!name) return 'CI';
    return name
        .split(' ')
        .filter(Boolean)
        .slice(0, 2)
        .map((w) => w[0]?.toUpperCase() || '')
        .join('') || 'CI';
}

export default function Company({ company, bankAccounts = [] }) {
    const fileInputRef = useRef(null);
    const [uploading, setUploading] = useState(false);
    const [dragOver, setDragOver] = useState(false);

    const form = useForm({
        name:                 company?.name                 || '',
        tagline:              company?.tagline              || '',
        phone:                company?.phone                || '',
        email_header_name:    company?.email_header_name    || '',
        email_header_initial: company?.email_header_initial || '',
    });

    const bankForm = useForm({ bank_name: '', account_number: '', account_holder: '' });

    const addBank = (e) => {
        e.preventDefault();
        bankForm.post('/settings/bank-accounts', {
            preserveScroll: true,
            onSuccess: () => bankForm.reset(),
        });
    };

    const removeBank = (index) => {
        if (!confirm('Remove this bank account?')) return;
        router.delete(`/settings/bank-accounts/${index}`, { preserveScroll: true });
    };

    const previewName    = form.data.name?.trim() || 'CIMS';
    const previewTagline = form.data.tagline?.trim() || '';
    const previewInitials = getInitials(previewName);

    // Email header preview — falls back to company name / initial if blank
    const emailHeaderName    = form.data.email_header_name?.trim()    || previewName;
    const emailHeaderInitial = form.data.email_header_initial?.trim() || (emailHeaderName[0]?.toUpperCase() || 'C');
    const logoUrl = company?.logo_url || null;

    const submitInfo = (e) => {
        e.preventDefault();
        form.put('/settings/company', { preserveScroll: true });
    };

    const uploadLogo = (file) => {
        if (!file) return;
        const fd = new FormData();
        fd.append('logo', file);
        setUploading(true);
        router.post('/settings/company/logo', fd, {
            forceFormData: true,
            preserveScroll: true,
            onFinish: () => setUploading(false),
        });
    };

    const handleFileChange = (e) => {
        const file = e.target.files?.[0];
        if (file) uploadLogo(file);
        e.target.value = '';
    };

    const handleRemoveLogo = () => {
        if (!confirm('Remove the company logo?')) return;
        router.delete('/settings/company/logo', { preserveScroll: true });
    };

    const handleDrop = (e) => {
        e.preventDefault();
        setDragOver(false);
        const file = e.dataTransfer?.files?.[0];
        if (file) uploadLogo(file);
    };

    return (
        <AuthenticatedLayout title="Company Settings">
            <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
                {/* ── LEFT: forms ──────────────────────────────────────────── */}
                <div className="lg:col-span-3 space-y-6">
                    {/* Company info card */}
                    <Card animate={false}>
                        <div className="flex items-start gap-3 mb-5">
                            <div className="p-2.5 rounded-xl bg-gold-500/10 text-gold-400 border border-gold-500/20 shrink-0">
                                <Building2 className="w-5 h-5" />
                            </div>
                            <div>
                                <h3 className="text-base font-semibold text-white">Company Info</h3>
                                <p className="text-xs text-navy-400 mt-0.5">Name and tagline shown across the app, PDFs, and the public catalog.</p>
                            </div>
                        </div>

                        <form onSubmit={submitInfo} className="space-y-4">
                            <Input
                                label="Company Name"
                                placeholder="e.g. Component Sales"
                                value={form.data.name}
                                onChange={(e) => form.setData('name', e.target.value)}
                                error={form.errors.name}
                                maxLength={100}
                            />
                            <Input
                                label="Tagline / Sub-line"
                                placeholder="e.g. Sistem Integrator"
                                value={form.data.tagline}
                                onChange={(e) => form.setData('tagline', e.target.value)}
                                error={form.errors.tagline}
                                maxLength={150}
                            />
                            <div>
                                <Input
                                    label="WhatsApp / Phone Number"
                                    placeholder="e.g. 0819-1000-2704"
                                    value={form.data.phone}
                                    onChange={(e) => form.setData('phone', e.target.value)}
                                    error={form.errors.phone}
                                    maxLength={30}
                                />
                                <p className="text-[10px] text-navy-500 mt-1">
                                    Shown in email footer. Clicking it opens WhatsApp.
                                    Use local format (08xx) or international (628xx).
                                </p>
                            </div>

                            {/* ── Email header customisation ── */}
                            <div className="pt-2 border-t border-white/5">
                                <div className="flex items-center gap-2 mb-3">
                                    <Mail className="w-4 h-4 text-sky-400" />
                                    <p className="text-sm font-medium text-white">Email Header</p>
                                    <span className="text-xs text-navy-500">— shown in email blast header. Leave blank to use Company Name above.</span>
                                </div>
                                <div className="grid grid-cols-3 gap-4">
                                    <div className="col-span-1">
                                        <Input
                                            label="Logo Letter / Initial"
                                            placeholder={emailHeaderName[0]?.toUpperCase() || 'C'}
                                            value={form.data.email_header_initial}
                                            onChange={(e) => form.setData('email_header_initial', e.target.value.toUpperCase().slice(0, 4))}
                                            error={form.errors.email_header_initial}
                                            maxLength={4}
                                        />
                                        <p className="text-[10px] text-navy-500 mt-1">Max 4 chars (e.g. C, IT, CIMS)</p>
                                    </div>
                                    <div className="col-span-2">
                                        <Input
                                            label="Header Company Name"
                                            placeholder={previewName}
                                            value={form.data.email_header_name}
                                            onChange={(e) => form.setData('email_header_name', e.target.value)}
                                            error={form.errors.email_header_name}
                                            maxLength={100}
                                        />
                                        <p className="text-[10px] text-navy-500 mt-1">Displayed next to the logo in email</p>
                                    </div>
                                </div>
                            </div>

                            <div className="flex items-center justify-end pt-2">
                                <Button type="submit" disabled={form.processing}>
                                    <Save className="w-4 h-4" />
                                    {form.processing ? 'Saving...' : 'Save Changes'}
                                </Button>
                            </div>
                        </form>
                    </Card>

                    {/* Bank Accounts card */}
                    <Card animate={false}>
                        <div className="flex items-start gap-3 mb-5">
                            <div className="p-2.5 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 shrink-0">
                                <Landmark className="w-5 h-5" />
                            </div>
                            <div>
                                <h3 className="text-base font-semibold text-white">Bank Accounts</h3>
                                <p className="text-xs text-navy-400 mt-0.5">Shown in WA messages when payment method is Transfer.</p>
                            </div>
                        </div>

                        {/* Existing accounts */}
                        {bankAccounts.length > 0 && (
                            <div className="space-y-2 mb-5">
                                {bankAccounts.map((b, i) => (
                                    <div key={i} className="flex items-center justify-between px-3 py-2.5 bg-navy-800/50 border border-white/5 rounded-xl">
                                        <div className="font-mono text-sm leading-tight">
                                            <span className="font-bold text-white">{b.bank_name}</span>
                                            <span className="text-navy-400"> : </span>
                                            <span className="text-gold-400">{b.account_number}</span>
                                            <div className="text-xs text-navy-400">({b.account_holder})</div>
                                        </div>
                                        <button
                                            type="button"
                                            onClick={() => removeBank(i)}
                                            className="p-1.5 rounded-lg hover:bg-red-500/10 text-navy-500 hover:text-red-400 transition shrink-0 ml-3"
                                        >
                                            <Trash2 className="w-3.5 h-3.5" />
                                        </button>
                                    </div>
                                ))}
                            </div>
                        )}

                        {/* Add form */}
                        <form onSubmit={addBank} className="space-y-3">
                            <div className="grid grid-cols-2 gap-3">
                                <Input
                                    label="Bank Name"
                                    placeholder="e.g. MANDIRI"
                                    value={bankForm.data.bank_name}
                                    onChange={(e) => bankForm.setData('bank_name', e.target.value.toUpperCase())}
                                    error={bankForm.errors.bank_name}
                                    maxLength={50}
                                />
                                <Input
                                    label="Account Number"
                                    placeholder="e.g. 120-00-30-606060"
                                    value={bankForm.data.account_number}
                                    onChange={(e) => bankForm.setData('account_number', e.target.value)}
                                    error={bankForm.errors.account_number}
                                    maxLength={50}
                                />
                            </div>
                            <Input
                                label="Account Holder"
                                placeholder="e.g. PT.AGRES INFO TEKNOLOGI"
                                value={bankForm.data.account_holder}
                                onChange={(e) => bankForm.setData('account_holder', e.target.value)}
                                error={bankForm.errors.account_holder}
                                maxLength={100}
                            />
                            <Button type="submit" className="w-full" disabled={bankForm.processing}>
                                <Plus className="w-4 h-4" />
                                {bankForm.processing ? 'Saving...' : 'Add Bank Account'}
                            </Button>
                        </form>
                    </Card>

                    {/* Logo card */}
                    <Card animate={false}>
                        <div className="flex items-start gap-3 mb-5">
                            <div className="p-2.5 rounded-xl bg-gold-500/10 text-gold-400 border border-gold-500/20 shrink-0">
                                <ImageIcon className="w-5 h-5" />
                            </div>
                            <div>
                                <h3 className="text-base font-semibold text-white">Company Logo</h3>
                                <p className="text-xs text-navy-400 mt-0.5">JPEG, PNG, WebP or SVG, up to 2 MB. Square or wide layouts both work.</p>
                            </div>
                        </div>

                        <div className="flex items-center gap-5 mb-5">
                            <div className="w-20 h-20 rounded-2xl overflow-hidden shrink-0 bg-gradient-to-br from-gold-400 to-gold-600 flex items-center justify-center border border-white/10">
                                {logoUrl
                                    ? <img src={logoUrl} alt={previewName} className="w-full h-full object-contain p-1" />
                                    : <span className="font-black text-navy-950 text-2xl">{previewInitials}</span>
                                }
                            </div>
                            <div className="min-w-0">
                                <p className="text-sm font-medium text-white truncate">{logoUrl ? 'Logo uploaded' : 'No logo set'}</p>
                                <p className="text-xs text-navy-400 mt-0.5">{logoUrl ? 'Uploading a new file will replace the current logo.' : 'The initials box will be shown until you upload a logo.'}</p>
                                {logoUrl && (
                                    <button
                                        type="button"
                                        onClick={handleRemoveLogo}
                                        className="mt-2 inline-flex items-center gap-1.5 text-xs font-medium text-red-400 hover:text-red-300 transition"
                                    >
                                        <Trash2 className="w-3.5 h-3.5" /> Remove logo
                                    </button>
                                )}
                            </div>
                        </div>

                        {/* Drop zone */}
                        <div
                            onClick={() => fileInputRef.current?.click()}
                            onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                            onDragLeave={() => setDragOver(false)}
                            onDrop={handleDrop}
                            className={`relative rounded-xl border-2 border-dashed transition-all duration-200 cursor-pointer p-6 text-center
                                ${dragOver ? 'border-gold-500/60 bg-gold-500/5' : 'border-white/10 hover:border-gold-500/40 hover:bg-white/[0.02]'}
                                ${uploading ? 'opacity-60 pointer-events-none' : ''}
                            `}
                        >
                            <input
                                ref={fileInputRef}
                                type="file"
                                accept="image/jpeg,image/png,image/jpg,image/webp,image/svg+xml"
                                onChange={handleFileChange}
                                className="hidden"
                            />
                            <Upload className="w-7 h-7 text-gold-400 mx-auto mb-2" />
                            <p className="text-sm font-medium text-white">
                                {uploading ? 'Uploading...' : 'Click to choose a file or drag & drop'}
                            </p>
                            <p className="text-xs text-navy-400 mt-1">jpeg, png, webp, svg &middot; max 2 MB</p>
                        </div>
                    </Card>
                </div>

                {/* ── RIGHT: live previews ─────────────────────────────────── */}
                <div className="lg:col-span-2">
                    <div className="lg:sticky lg:top-20 space-y-6">
                        <Card animate={false}>
                            <div className="flex items-center gap-2 mb-4">
                                <Sparkles className="w-4 h-4 text-gold-400" />
                                <h3 className="text-base font-semibold text-white">Live Preview</h3>
                            </div>

                            {/* Sidebar mockup */}
                            <p className="text-[10px] uppercase tracking-wider text-navy-500 font-bold mb-2">Sidebar header</p>
                            <div className="rounded-xl border border-white/10 bg-navy-900/90 overflow-hidden mb-5">
                                <div className="h-16 flex items-center px-4 border-b border-white/5">
                                    <div className="flex items-center gap-3 min-w-0">
                                        <div className="w-9 h-9 rounded-lg overflow-hidden shrink-0 bg-gradient-to-br from-gold-400 to-gold-600 flex items-center justify-center">
                                            {logoUrl
                                                ? <img src={logoUrl} alt={previewName} className="w-full h-full object-contain p-0.5" />
                                                : <span className="font-bold text-navy-950 text-sm">{previewInitials}</span>
                                            }
                                        </div>
                                        <div className="min-w-0">
                                            <p className="font-bold text-sm text-white whitespace-nowrap leading-tight truncate">{previewName}</p>
                                            {previewTagline && (
                                                <p className="text-[10px] text-navy-500 whitespace-nowrap leading-tight truncate">{previewTagline}</p>
                                            )}
                                        </div>
                                    </div>
                                </div>
                                <div className="px-4 py-3 space-y-1.5">
                                    <div className="h-2 w-3/4 rounded-full bg-white/5" />
                                    <div className="h-2 w-2/3 rounded-full bg-white/5" />
                                    <div className="h-2 w-1/2 rounded-full bg-white/5" />
                                </div>
                            </div>

                            {/* Email header mockup */}
                            <p className="text-[10px] uppercase tracking-wider text-navy-500 font-bold mb-2">Email header</p>
                            <div className="rounded-xl overflow-hidden mb-5 border border-white/5">
                                <div style={{ background: 'linear-gradient(135deg,#1a1a2e 0%,#16213e 50%,#0f3460 100%)', padding: '18px 24px', textAlign: 'center' }}>
                                    <div style={{
                                        width: 44, height: 44,
                                        background: 'linear-gradient(135deg,#D4AF37,#F5D060)',
                                        borderRadius: 11,
                                        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                                        overflow: 'hidden',
                                        flexShrink: 0,
                                    }}>
                                        {logoUrl
                                            ? <img src={logoUrl} alt={emailHeaderName} style={{ width: 44, height: 44, objectFit: 'contain', display: 'block' }} />
                                            : <span style={{ fontSize: emailHeaderInitial.length > 2 ? 11 : 17, fontWeight: 800, color: '#1a1a2e', letterSpacing: '-0.5px' }}>{emailHeaderInitial}</span>
                                        }
                                    </div>
                                    <p style={{ margin: '10px 0 0', fontSize: 14, fontWeight: 700, color: '#ffffff', letterSpacing: '-0.3px' }}>{emailHeaderName}</p>
                                    {previewTagline && <p style={{ margin: '4px 0 0', fontSize: 10, color: '#D4AF37', letterSpacing: '1.5px', textTransform: 'uppercase', fontWeight: 600 }}>{previewTagline}</p>}
                                </div>
                            </div>

                            {/* PDF mockup */}
                            <p className="text-[10px] uppercase tracking-wider text-navy-500 font-bold mb-2">PDF document header</p>
                            <div className="rounded-xl border border-white/10 bg-white text-gray-800 p-4">
                                <div className="flex items-start justify-between gap-3">
                                    <div className="min-w-0">
                                        {logoUrl && (
                                            <img src={logoUrl} alt={previewName} className="h-7 max-w-[120px] object-contain mb-1" />
                                        )}
                                        <p className="text-base font-bold text-gray-900 leading-tight truncate">{previewName}</p>
                                        {previewTagline && (
                                            <p className="text-[10px] text-gray-500 leading-tight truncate">{previewTagline}</p>
                                        )}
                                    </div>
                                    <div className="text-right shrink-0">
                                        <div className="text-[10px] uppercase font-bold text-gray-400 tracking-wider">Surat Pesanan</div>
                                        <div className="text-[11px] font-mono text-gray-700">ORD-000123</div>
                                    </div>
                                </div>
                                <div className="mt-3 pt-3 border-t border-gray-200 space-y-1">
                                    <div className="h-1.5 w-full rounded-full bg-gray-100" />
                                    <div className="h-1.5 w-5/6 rounded-full bg-gray-100" />
                                    <div className="h-1.5 w-4/6 rounded-full bg-gray-100" />
                                </div>
                                <div className="mt-3 flex items-center gap-1.5 text-[9px] text-gray-400">
                                    <FileText className="w-3 h-3" />
                                    <span><strong className="text-gray-600">{previewName}</strong> &middot; Auto-generated</span>
                                </div>
                            </div>
                        </Card>
                    </div>
                </div>
            </div>
        </AuthenticatedLayout>
    );
}
