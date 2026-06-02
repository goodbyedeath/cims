import { router } from '@inertiajs/react';
import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import Card from '@/Components/ui/Card';
import Select from '@/Components/ui/Select';
import Badge from '@/Components/ui/Badge';
import { gradeColor, statusColor } from '@/Lib/utils';
import { Sun, Search, X, SlidersHorizontal } from 'lucide-react';
import { useEffect, useState, useRef } from 'react';

const gradeColors = {
    platinum: '#a855f7',
    gold: '#D4AF37',
    silver: '#9ca3af',
    risk: '#ef4444',
};

export default function MapPage({ channels, filters, provinces }) {
    const mapRef = useRef(null);
    const mapInstanceRef = useRef(null);
    const markersRef = useRef({});
    const [mapReady, setMapReady] = useState(false);
    const [selectedChannel, setSelectedChannel] = useState(null);
    const [brightness, setBrightness] = useState(80);
    const [contrast, setContrast] = useState(100);
    const [showMapControls, setShowMapControls] = useState(false);
    const [search, setSearch] = useState('');
    const listRef = useRef(null);

    const filteredChannels = search.trim()
        ? channels.filter((ch) => {
            const q = search.toLowerCase();
            return (
                ch.company_name?.toLowerCase().includes(q) ||
                ch.channel_code?.toLowerCase().includes(q) ||
                ch.owner_name?.toLowerCase().includes(q) ||
                ch.city?.toLowerCase().includes(q) ||
                ch.province?.toLowerCase().includes(q)
            );
        })
        : channels;

    // Initialize the map once on mount — no channels dependency so the
    // map instance and tile layer survive filter changes.
    // Sets mapReady=true when done so the markers effect can safely fire.
    useEffect(() => {
        let cancelled = false;
        (async () => {
            const L = (await import('leaflet')).default;
            await import('leaflet/dist/leaflet.css');
            if (cancelled || !mapRef.current || mapInstanceRef.current) return;
            mapInstanceRef.current = L.map(mapRef.current).setView([-6.5, 107.5], 7);
            L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
                attribution: '&copy; OpenStreetMap contributors &copy; CARTO',
                maxZoom: 19,
            }).addTo(mapInstanceRef.current);
            if (!cancelled) setMapReady(true);
        })();
        return () => { cancelled = true; };
    }, []);

    // Destroy map on unmount only.
    useEffect(() => {
        return () => {
            if (mapInstanceRef.current) {
                mapInstanceRef.current.remove();
                mapInstanceRef.current = null;
            }
        };
    }, []);

    // Update markers whenever channels change (filter applied) or map becomes ready.
    // mapReady ensures this never runs before the map instance exists.
    useEffect(() => {
        if (!mapReady) return;
        let cancelled = false;
        (async () => {
            const L = (await import('leaflet')).default;
            if (cancelled || !mapInstanceRef.current) return;

            // Remove old markers
            Object.values(markersRef.current).forEach((m) => m.remove());
            markersRef.current = {};

            const map = mapInstanceRef.current;
            const bounds = L.latLngBounds();

            channels.forEach((ch) => {
                const color = gradeColors[ch.channel_grade] || '#ef4444';

                const icon = L.divIcon({
                    className: 'custom-marker',
                    html: `<div style="width:12px;height:12px;border-radius:50%;background:${color};border:2px solid #333;box-shadow:0 0 8px ${color}80;"></div>`,
                    iconSize: [12, 12],
                    iconAnchor: [6, 6],
                });

                const latlng = [ch.latitude, ch.longitude];
                const marker = L.marker(latlng, { icon }).addTo(map);
                markersRef.current[ch.id] = marker;
                bounds.extend(latlng);

                marker.bindPopup(`
                    <div style="font-family:system-ui;min-width:180px;color:#1a1a2e;">
                        <div style="font-weight:700;font-size:14px;margin-bottom:4px;">${ch.company_name}</div>
                        <div style="color:#666;font-size:11px;margin-bottom:6px;">${ch.channel_code}</div>
                        <div style="font-size:12px;margin-bottom:2px;">Owner: ${ch.gender === 'female' ? 'Bu' : 'Pak'} ${ch.owner_name}</div>
                        <div style="font-size:12px;margin-bottom:2px;">Phone: ${ch.phone || '-'}</div>
                        <div style="font-size:12px;margin-bottom:2px;">Location: ${ch.city}, ${ch.province}</div>
                        <div style="font-size:12px;margin-bottom:2px;">Grade: <strong style="color:${color}">${(ch.channel_grade || 'unranked').toUpperCase()}</strong></div>
                        <div style="font-size:12px;">Score: <strong>${ch.performance_score}</strong></div>
                    </div>
                `);

                marker.on('click', () => setSelectedChannel(ch));
            });

            if (bounds.isValid()) {
                map.fitBounds(bounds, { padding: [40, 40], maxZoom: 13 });
            }
        })();

        return () => {
            cancelled = true;
            Object.values(markersRef.current).forEach((m) => m.remove());
            markersRef.current = {};
        };
    }, [channels, mapReady]);

    const handleFilter = (key, value) => {
        router.get('/map', { ...filters, [key]: value }, { preserveState: true });
    };

    const handleSelectChannel = (ch) => {
        setSelectedChannel(ch);
        // Fly map to channel and open popup
        if (mapInstanceRef.current && ch.latitude && ch.longitude) {
            mapInstanceRef.current.flyTo([ch.latitude, ch.longitude], 14, { duration: 1 });
            const marker = markersRef.current[ch.id];
            if (marker) setTimeout(() => marker.openPopup(), 800);
        }
    };

    const gradeSummary = ['platinum', 'gold', 'silver', 'risk'].map((g) => ({
        grade: g,
        count: channels.filter((c) => c.channel_grade === g).length,
        color: gradeColors[g],
    }));

    return (
        <AuthenticatedLayout title="Geo Map">
            {/* Filter bar — filters + grade legend only, sliders moved onto map */}
            <div className="flex items-center gap-3 flex-wrap mb-4">
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
                <Select
                    value={filters.province || ''}
                    onChange={(e) => handleFilter('province', e.target.value)}
                    placeholder="All Provinces"
                    options={provinces.map((p) => ({ value: p, label: p }))}
                />

                <div className="ml-auto flex items-center gap-3 flex-wrap">
                    {gradeSummary.map((g) => (
                        <div key={g.grade} className="flex items-center gap-1.5 text-xs">
                            <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: g.color }} />
                            <span className="text-navy-300 capitalize">{g.grade}</span>
                            <span className="text-white font-semibold">{g.count}</span>
                        </div>
                    ))}
                </div>
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-4 gap-6">
                <div className="xl:col-span-3">
                    <Card animate={false} className="p-0 overflow-hidden relative" style={{ isolation: 'isolate' }}>
                        <style>{`.leaflet-tile-pane { filter: brightness(${brightness}%) contrast(${contrast}%); }`}</style>
                        <div ref={mapRef} style={{ height: '600px', width: '100%' }} />

                        {/* Floating map display controls — always visible on any screen */}
                        <div className="absolute top-3 right-3 z-[1000]">
                            <button
                                onClick={() => setShowMapControls(v => !v)}
                                className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium shadow-lg transition ${
                                    showMapControls
                                        ? 'bg-navy-800 border border-gold-500/30 text-gold-400'
                                        : 'bg-navy-900/90 border border-white/10 text-navy-300 hover:text-white'
                                }`}
                            >
                                <SlidersHorizontal className="w-3.5 h-3.5" />
                                <span>Display</span>
                            </button>

                            {showMapControls && (
                                <div className="mt-1.5 p-3 bg-navy-900/95 border border-white/10 rounded-xl shadow-2xl w-52 space-y-3 backdrop-blur-sm">
                                    <div>
                                        <div className="flex items-center justify-between mb-1.5">
                                            <div className="flex items-center gap-1.5">
                                                <Sun className="w-3.5 h-3.5 text-navy-400" />
                                                <span className="text-xs text-navy-300">Brightness</span>
                                            </div>
                                            <span className="text-xs font-medium text-white">{brightness}%</span>
                                        </div>
                                        <input
                                            type="range" min={30} max={130} value={brightness}
                                            onChange={(e) => setBrightness(Number(e.target.value))}
                                            className="w-full h-1.5 accent-gold-500 cursor-pointer"
                                        />
                                    </div>
                                    <div>
                                        <div className="flex items-center justify-between mb-1.5">
                                            <span className="text-xs text-navy-300">Contrast</span>
                                            <span className="text-xs font-medium text-white">{contrast}%</span>
                                        </div>
                                        <input
                                            type="range" min={30} max={200} value={contrast}
                                            onChange={(e) => setContrast(Number(e.target.value))}
                                            className="w-full h-1.5 accent-gold-500 cursor-pointer"
                                        />
                                    </div>
                                    <button
                                        onClick={() => { setBrightness(80); setContrast(100); }}
                                        className="w-full text-xs text-navy-500 hover:text-navy-300 transition text-center pt-1 border-t border-white/5"
                                    >
                                        Reset to default
                                    </button>
                                </div>
                            )}
                        </div>
                    </Card>
                </div>

                <div>
                    <Card className="flex flex-col" style={{ maxHeight: '648px' }}>
                        {selectedChannel ? (
                            <>
                                <div className="flex items-center justify-between mb-3">
                                    <h3 className="text-lg font-semibold text-white">Channel Detail</h3>
                                    <button
                                        onClick={() => setSelectedChannel(null)}
                                        className="p-1.5 rounded-lg text-navy-400 hover:text-white hover:bg-white/5 transition"
                                    >
                                        <X className="w-4 h-4" />
                                    </button>
                                </div>
                                <div className="space-y-3 text-sm overflow-y-auto flex-1">
                                    <div>
                                        <p className="font-bold text-white text-base">{selectedChannel.company_name}</p>
                                        <p className="text-navy-400 text-xs font-mono">{selectedChannel.channel_code}</p>
                                    </div>
                                    <div className="flex gap-2">
                                        <Badge className={statusColor(selectedChannel.status)}>{selectedChannel.status}</Badge>
                                        <Badge className={gradeColor(selectedChannel.channel_grade)}>{selectedChannel.channel_grade}</Badge>
                                    </div>
                                    <p className="text-navy-300">{selectedChannel.owner_name}</p>
                                    <p className="text-navy-300">{selectedChannel.phone}</p>
                                    <p className="text-navy-300 text-xs">{selectedChannel.address}</p>
                                    <p className="text-navy-300 text-xs">{selectedChannel.city}, {selectedChannel.province}</p>
                                    <div className="pt-3 border-t border-white/5">
                                        <p className="text-xs text-navy-400 mb-1">Performance Score</p>
                                        <div className="flex items-center gap-3">
                                            <div className="flex-1 h-2 bg-navy-800 rounded-full overflow-hidden">
                                                <div
                                                    className="h-full rounded-full bg-gradient-to-r from-gold-500 to-gold-400"
                                                    style={{ width: `${selectedChannel.performance_score}%` }}
                                                />
                                            </div>
                                            <span className="text-gold-400 font-bold text-sm">{selectedChannel.performance_score}</span>
                                        </div>
                                    </div>
                                </div>
                            </>
                        ) : (
                            <>
                                <div className="flex items-center justify-between mb-3">
                                    <h3 className="text-lg font-semibold text-white">
                                        Channel List
                                        <span className="ml-2 text-sm font-normal text-navy-400">
                                            ({filteredChannels.length})
                                        </span>
                                    </h3>
                                </div>

                                {/* Search */}
                                <div className="relative mb-3">
                                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-navy-400 pointer-events-none" />
                                    <input
                                        type="text"
                                        value={search}
                                        onChange={(e) => setSearch(e.target.value)}
                                        placeholder="Search name, code, city..."
                                        className="w-full pl-9 pr-8 py-2 bg-navy-800/50 border border-white/10 rounded-lg text-sm text-white placeholder-navy-500 focus:outline-none focus:ring-2 focus:ring-gold-500/30"
                                    />
                                    {search && (
                                        <button
                                            onClick={() => setSearch('')}
                                            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-navy-400 hover:text-white transition"
                                        >
                                            <X className="w-3.5 h-3.5" />
                                        </button>
                                    )}
                                </div>

                                {/* List */}
                                <div ref={listRef} className="space-y-1 overflow-y-auto flex-1" style={{ maxHeight: '480px' }}>
                                    {filteredChannels.length > 0 ? filteredChannels.map((ch) => (
                                        <button
                                            key={ch.id}
                                            onClick={() => handleSelectChannel(ch)}
                                            className="w-full text-left p-2.5 rounded-lg hover:bg-white/5 transition"
                                        >
                                            <p className="text-sm font-medium text-white truncate">{ch.company_name}</p>
                                            <div className="flex items-center gap-2 mt-1">
                                                <span className="text-xs text-navy-500 font-mono">{ch.channel_code}</span>
                                                <span className="text-xs text-navy-400">{ch.city}</span>
                                                <Badge className={gradeColor(ch.channel_grade) + ' !text-[10px] !px-1.5 ml-auto'}>{ch.channel_grade}</Badge>
                                            </div>
                                        </button>
                                    )) : (
                                        <p className="text-sm text-navy-500 text-center py-6">No channels found</p>
                                    )}
                                </div>
                            </>
                        )}
                    </Card>
                </div>
            </div>
        </AuthenticatedLayout>
    );
}
