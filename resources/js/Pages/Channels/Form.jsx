import { useForm, Link } from '@inertiajs/react';
import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import Card from '@/Components/ui/Card';
import Input from '@/Components/ui/Input';
import Select from '@/Components/ui/Select';
import Button from '@/Components/ui/Button';
import { ArrowLeft, Save, MapPin, RefreshCw } from 'lucide-react';
import { useState } from 'react';

export default function Form({ channel, users, suggestedCode }) {
    const isEdit = !!channel;
    const [geocoding, setGeocoding] = useState(false);
    const [regenerating, setRegenerating] = useState(false);
    const [geocodeError, setGeocodeError] = useState('');

    const { data, setData, post, put, processing, errors } = useForm({
        channel_code: channel?.channel_code || suggestedCode || '',
        company_name: channel?.company_name || '',
        owner_name: channel?.owner_name || '',
        gender: channel?.gender || 'male',
        purchasing_staff: channel?.purchasing_staff || '',
        phone: channel?.phone || '',
        email: channel?.email || '',
        address: channel?.address || '',
        province: channel?.province || '',
        city: channel?.city || '',
        district: channel?.district || '',
        latitude: channel?.latitude || '',
        longitude: channel?.longitude || '',
        assigned_user_id: channel?.assigned_user_id || '',
        status: channel?.status || 'active',
        blacklist_reason: channel?.blacklist_reason || '',
    });

    // Build initial fullAddress from existing channel data
    const buildFullAddress = () => {
        if (!channel) return '';
        return [channel.address, channel.district, channel.city, channel.province]
            .filter(Boolean)
            .join(', ');
    };

    const [fullAddress, setFullAddress] = useState(buildFullAddress);

    const parseFullAddress = (text) => {
        const parts = text.split(',').map((s) => s.trim()).filter(Boolean);
        if (parts.length < 2) return null;

        const province = parts.length >= 4 ? parts[parts.length - 1] : '';
        const city = parts[parts.length - (parts.length >= 4 ? 2 : 1)];
        const district = parts.length >= 4 ? parts[parts.length - 3] : (parts.length === 3 ? parts[parts.length - 2] : '');
        const address = parts.slice(0, parts.length >= 4 ? parts.length - 3 : parts.length - 2).join(', ') || parts[0];

        return { address, district, city, province };
    };

    const handleFullAddressChange = (e) => {
        const val = e.target.value;
        setFullAddress(val);

        // Auto-parse as user types
        const parsed = parseFullAddress(val);
        if (parsed) {
            setData((prev) => ({
                ...prev,
                address: parsed.address,
                district: parsed.district,
                city: parsed.city,
                province: parsed.province,
            }));
        }
    };

    const findLocation = async () => {
        if (!fullAddress.trim()) {
            setGeocodeError('Isi alamat lengkap terlebih dahulu.');
            return;
        }

        const parsed = parseFullAddress(fullAddress);
        if (!parsed) {
            setGeocodeError('Format: Alamat, Kecamatan, Kota, Provinsi');
            return;
        }

        const { address, district, city, province } = parsed;

        // Fill parsed fields immediately
        setData((prev) => ({ ...prev, address, district, city, province }));

        setGeocoding(true);
        setGeocodeError('');
        try {
            const queries = [
                [city, province, 'Indonesia'].filter(Boolean).join(', '),
                [district, city, province, 'Indonesia'].filter(Boolean).join(', '),
            ];

            let results = [];
            for (const q of queries) {
                const res = await fetch(`https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(q)}&format=json&limit=1`, {
                    headers: { 'Accept-Language': 'id' },
                });
                results = await res.json();
                if (results.length > 0) break;
            }

            if (results.length > 0) {
                setData((prev) => ({
                    ...prev,
                    address,
                    district,
                    city,
                    province,
                    latitude: results[0].lat,
                    longitude: results[0].lon,
                }));
                setGeocodeError('');
            } else {
                // Still fill the parsed fields even if geocode fails
                setData((prev) => ({ ...prev, address, district, city, province }));
                setGeocodeError('Koordinat tidak ditemukan, tapi alamat sudah diisi.');
            }
        } catch {
            setData((prev) => ({ ...prev, address, district, city, province }));
            setGeocodeError('Gagal mencari koordinat. Alamat tetap diisi.');
        } finally {
            setGeocoding(false);
        }
    };

    const regenerateCode = async () => {
        setRegenerating(true);
        try {
            const res = await fetch('/channels-generate-code', { headers: { Accept: 'application/json' } });
            const json = await res.json();
            if (json.code) setData('channel_code', json.code);
        } catch {}
        setRegenerating(false);
    };

    const submit = (e) => {
        e.preventDefault();
        if (isEdit) {
            put(`/channels/${channel.id}`, { preserveScroll: true });
        } else {
            post('/channels');
        }
    };

    return (
        <AuthenticatedLayout title={isEdit ? 'Edit Channel' : 'Create Channel'}>
            <div className="mb-6">
                <Link href="/channels" className="inline-flex items-center gap-2 text-sm text-navy-400 hover:text-white transition">
                    <ArrowLeft className="w-4 h-4" /> Back to Channels
                </Link>
            </div>

            <Card animate={false} className="max-w-4xl">
                <form onSubmit={submit} className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                        <div>
                            <label className="block text-sm font-medium text-navy-200 mb-1.5">
                                Channel Code
                                {!isEdit && <span className="ml-1.5 text-xs text-gold-400">(auto-generated)</span>}
                            </label>
                            <div className="flex gap-2">
                                <input
                                    type="text"
                                    value={data.channel_code}
                                    onChange={(e) => setData('channel_code', e.target.value)}
                                    readOnly={!isEdit}
                                    className="flex-1 px-4 py-2.5 bg-navy-800/50 border border-white/10 rounded-lg text-white text-sm font-mono placeholder-navy-500 focus:outline-none focus:ring-2 focus:ring-gold-500/30 focus:border-gold-500/50 read-only:opacity-70 read-only:cursor-default"
                                    placeholder="CH-0001"
                                />
                                {!isEdit && (
                                    <button
                                        type="button"
                                        onClick={regenerateCode}
                                        disabled={regenerating}
                                        className="px-3 py-2.5 rounded-lg bg-navy-800/50 border border-white/10 text-navy-400 hover:text-white hover:bg-white/5 transition disabled:opacity-50"
                                        title="Generate new code"
                                    >
                                        <RefreshCw className={`w-4 h-4 ${regenerating ? 'animate-spin' : ''}`} />
                                    </button>
                                )}
                            </div>
                            {errors.channel_code && <p className="text-xs text-red-400 mt-1">{errors.channel_code}</p>}
                        </div>
                        <Input label="Company Name" value={data.company_name} onChange={(e) => setData('company_name', e.target.value)} error={errors.company_name} />
                        <Input label="Owner Name" value={data.owner_name} onChange={(e) => setData('owner_name', e.target.value)} error={errors.owner_name} />
                        <Select
                            label="Gender"
                            value={data.gender}
                            onChange={(e) => setData('gender', e.target.value)}
                            placeholder="Select Gender"
                            options={[
                                { value: 'male', label: 'Laki-laki (Pak)' },
                                { value: 'female', label: 'Perempuan (Bu)' },
                            ]}
                            error={errors.gender}
                        />
                        <Input label="Purchasing Staff" value={data.purchasing_staff} onChange={(e) => setData('purchasing_staff', e.target.value)} error={errors.purchasing_staff} />
                        <Input label="Phone" value={data.phone} onChange={(e) => setData('phone', e.target.value)} error={errors.phone} />
                        <Input label="Email" type="email" value={data.email} onChange={(e) => setData('email', e.target.value)} error={errors.email} />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-navy-200 mb-1.5">Full Address</label>
                        <div className="flex gap-2">
                            <input
                                type="text"
                                value={fullAddress}
                                onChange={handleFullAddressChange}
                                placeholder="Jl. Monginsidi No. 89, Lolu Selatan, Palu, Sulawesi Tengah"
                                className="flex-1 px-4 py-2.5 bg-navy-800/50 border border-white/10 rounded-lg text-white text-sm placeholder-navy-500 focus:outline-none focus:ring-2 focus:ring-gold-500/30 focus:border-gold-500/50"
                            />
                            <button
                                type="button"
                                onClick={findLocation}
                                disabled={geocoding}
                                className="inline-flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium rounded-lg bg-gold-500/10 text-gold-400 hover:bg-gold-500/20 border border-gold-500/20 transition disabled:opacity-50 shrink-0"
                            >
                                <MapPin className="w-4 h-4" />
                                {geocoding ? 'Mencari...' : 'Auto-fill'}
                            </button>
                        </div>
                        <p className="text-xs text-navy-500 mt-1">Format: Alamat, Kecamatan, Kota, Provinsi</p>
                        {geocodeError && <p className="text-xs text-red-400 mt-1">{geocodeError}</p>}
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                        <div className="md:col-span-2">
                            <label className="block text-sm font-medium text-navy-200 mb-1.5">Address</label>
                            <textarea
                                value={data.address}
                                onChange={(e) => setData('address', e.target.value)}
                                rows={2}
                                className="w-full px-4 py-2.5 bg-navy-800/50 border border-white/10 rounded-lg text-white text-sm placeholder-navy-500 focus:outline-none focus:ring-2 focus:ring-gold-500/30 focus:border-gold-500/50"
                                placeholder="Filled automatically or type manually"
                            />
                            {errors.address && <p className="text-xs text-red-400 mt-1">{errors.address}</p>}
                        </div>
                        <Input label="Province" value={data.province} onChange={(e) => setData('province', e.target.value)} error={errors.province} placeholder="Filled automatically" />
                        <Input label="City" value={data.city} onChange={(e) => setData('city', e.target.value)} error={errors.city} placeholder="Filled automatically" />
                        <Input label="District" value={data.district} onChange={(e) => setData('district', e.target.value)} error={errors.district} placeholder="Filled automatically" />
                    </div>

                    <div>
                        <label className="text-sm font-medium text-navy-200 mb-1.5 block">Coordinates (Optional — filled automatically)</label>
                        <div className="grid grid-cols-2 gap-5">
                            <Input label="" type="number" step="any" value={data.latitude} onChange={(e) => setData('latitude', e.target.value)} error={errors.latitude} placeholder="Latitude" />
                            <Input label="" type="number" step="any" value={data.longitude} onChange={(e) => setData('longitude', e.target.value)} error={errors.longitude} placeholder="Longitude" />
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                        <Select
                            label="Assigned Sales"
                            value={data.assigned_user_id}
                            onChange={(e) => setData('assigned_user_id', e.target.value)}
                            placeholder="Select sales person"
                            options={users?.map((u) => ({ value: u.id, label: `${u.name} (${u.role})` })) || []}
                            error={errors.assigned_user_id}
                        />
                        <Select
                            label="Status"
                            value={data.status}
                            onChange={(e) => {
                                setData('status', e.target.value);
                                if (e.target.value !== 'blacklist') setData('blacklist_reason', '');
                            }}
                            options={[
                                { value: 'active', label: 'Active' },
                                { value: 'inactive', label: 'Inactive' },
                                { value: 'blacklist', label: 'Blacklist' },
                            ]}
                            error={errors.status}
                        />
                    </div>

                    {data.status === 'blacklist' && (
                        <div>
                            <label className="block text-sm font-medium text-red-400 mb-1.5">
                                Blacklist Reason <span className="text-red-500">*</span>
                            </label>
                            <textarea
                                value={data.blacklist_reason}
                                onChange={(e) => setData('blacklist_reason', e.target.value)}
                                rows={3}
                                placeholder="Jelaskan alasan channel ini diblacklist..."
                                className="w-full px-4 py-2.5 bg-red-500/5 border border-red-500/30 rounded-lg text-white text-sm placeholder-navy-500 focus:outline-none focus:ring-2 focus:ring-red-500/30 focus:border-red-500/50"
                            />
                            {errors.blacklist_reason && <p className="text-xs text-red-400 mt-1">{errors.blacklist_reason}</p>}
                        </div>
                    )}

                    <div className="flex items-center gap-3 pt-4 border-t border-white/5">
                        <Button type="submit" disabled={processing}>
                            <Save className="w-4 h-4" />
                            {processing ? 'Saving...' : (isEdit ? 'Update Channel' : 'Create Channel')}
                        </Button>
                        <Link href="/channels">
                            <Button type="button" variant="secondary">Cancel</Button>
                        </Link>
                    </div>
                </form>
            </Card>
        </AuthenticatedLayout>
    );
}
