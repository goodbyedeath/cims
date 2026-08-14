import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Link, usePage, router } from '@inertiajs/react';
import { motion, AnimatePresence, Reorder } from 'framer-motion';
import {
    LayoutDashboard, Building2, ShoppingCart, CreditCard,
    Map, Brain, FileText, Bell, Menu, X, ChevronDown, Store,
    LogOut, User, Package, Users, MessageSquare, Mail,
    AlertTriangle, CheckCheck, ClipboardList, ExternalLink, Clock, ShieldAlert,
    GripVertical, Check, Kanban, Download, MonitorSmartphone, BookOpen, Settings, Search,
    Sparkles, Bot, ListChecks, ScanText, Smartphone
} from 'lucide-react';
import { cn, csrfHeaders } from '@/Lib/utils';

// Sidebar navigation grouped into collapsible categories. Item order within a
// category can still be drag-customized (persisted per role); category
// collapse state is persisted separately.
const NAV_CATEGORIES = [
    {
        key: 'overview',
        label: 'Overview',
        items: [
            { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
            { name: 'Reports', href: '/reports', icon: FileText },
            { name: 'Map', href: '/map', icon: Map },
            { name: 'Search', href: '/search', icon: Search },
        ],
    },
    {
        key: 'sales',
        label: 'Sales',
        items: [
            { name: 'Channels', href: '/channels', icon: Building2 },
            { name: 'Find Prospect', href: '/leads', icon: Store, admin: true },
            { name: 'Requests', href: '/channel-requests', icon: ClipboardList },
            { name: 'Pipeline', href: '/pipeline', icon: Kanban },
            { name: 'Orders', href: '/orders', icon: ShoppingCart },
            { name: 'Offerings', href: '/offerings', icon: FileText },
            { name: 'Payments', href: '/payments', icon: CreditCard },
        ],
    },
    {
        key: 'products',
        label: 'Products',
        items: [
            { name: 'Inventory', href: '/inventory', icon: Package },
            { name: 'Catalog', href: '/catalog', icon: BookOpen },
        ],
    },
    {
        key: 'messaging',
        label: 'Messaging',
        items: [
            { name: 'WA Blast', href: '/wa-blast', icon: MessageSquare },
            { name: 'WA Chatbot', href: '/wa-bot', icon: Bot, admin: true },
            { name: 'WA Forms', href: '/wa-forms', icon: ListChecks, admin: true },
            { name: 'WA Devices', href: '/wa-devices', icon: Smartphone, admin: true },
            { name: 'Email Blast', href: '/email-blast', icon: Mail },
        ],
    },
    {
        key: 'ai',
        label: 'AI Tools',
        items: [
            { name: 'AI Scores', href: '/ai-scores', icon: Brain },
            { name: 'RAG', href: '/admin/rag', icon: Sparkles, admin: true, healthGated: true },
            { name: 'OCR', href: '/ocr', icon: ScanText, admin: true },
        ],
    },
    {
        key: 'admin',
        label: 'Administration',
        items: [
            { name: 'Accounts', href: '/users', icon: Users, admin: true },
            { name: 'Login Logs', href: '/login-attempts', icon: ShieldAlert, admin: true },
        ],
    },
];

const notifIcons = {
    'new_order': ShoppingCart,
    'new_channel': Building2,
    'overdue_installment': AlertTriangle,
    'low_stock': Package,
};

const notifColors = {
    'new_order': 'text-blue-400',
    'new_channel': 'text-emerald-400',
    'overdue_installment': 'text-red-400',
    'low_stock': 'text-yellow-400',
};

export default function AuthenticatedLayout({ children, title }) {
    const { auth, flash, unreadNotifications, company } = usePage().props;
    const isAdmin = auth?.user?.role === 'admin';
    // Categories visible to this role — a category disappears entirely when all
    // of its items are admin-only and the user isn't an admin.
    const categories = NAV_CATEGORIES
        .map((cat) => ({ ...cat, items: cat.items.filter((item) => !item.admin || isAdmin) }))
        .filter((cat) => cat.items.length > 0);

    // ── RAG backend health ──────────────────────────────────────────────────────
    // Poll the tunnel health so the sidebar can disable the RAG link while the
    // self-hosted backend is unreachable. Only relevant for admins (the only
    // role that sees the RAG item). null = unknown (treated as enabled).
    const [ragStatus, setRagStatus] = useState(null); // 'ok' | 'degraded' | 'offline' | 'unconfigured' | null
    const ragDisabled = ragStatus === 'offline' || ragStatus === 'unconfigured';

    useEffect(() => {
        if (!isAdmin) return;
        const POLL_MS = 60_000;
        let timer = null;

        const check = async () => {
            try {
                const res = await fetch('/admin/rag/health', { headers: { Accept: 'application/json' } });
                if (res.ok) {
                    const json = await res.json();
                    setRagStatus(json.configured === false ? 'unconfigured' : (json.status || 'offline'));
                } else {
                    setRagStatus('offline');
                }
            } catch {
                setRagStatus('offline');
            }
            timer = setTimeout(check, POLL_MS);
        };

        const onVisibility = () => {
            if (document.visibilityState === 'visible') { clearTimeout(timer); check(); }
            else { clearTimeout(timer); }
        };

        check();
        document.addEventListener('visibilitychange', onVisibility);
        return () => {
            clearTimeout(timer);
            document.removeEventListener('visibilitychange', onVisibility);
        };
    }, [isAdmin]);

    const companyName    = company?.name || 'CIMS';
    const companyTagline = company?.tagline || '';
    const companyLogoUrl = company?.logo_url || null;
    const companyInitials = companyName
        .split(' ')
        .filter(Boolean)
        .slice(0, 2)
        .map((w) => w[0]?.toUpperCase() || '')
        .join('') || 'CI';

    // Sidebar item order — persisted in localStorage per role as one flat name
    // list (backwards-compatible with the pre-category format) and applied
    // within each category.
    const storageKey = `cims_nav_order_${auth?.user?.role || 'user'}`;
    const applyStoredOrder = (items) => {
        try {
            const saved = JSON.parse(localStorage.getItem(storageKey) || '[]');
            if (!Array.isArray(saved) || !saved.length) return items;
            const seen = new Set();
            const sorted = [];
            // Honour the saved order, skipping unknown or duplicate names
            saved.forEach((name) => {
                if (seen.has(name)) return;
                const item = items.find((i) => i.name === name);
                if (item) { sorted.push(item); seen.add(name); }
            });
            // Append any items missing from the saved order (e.g. newly added menu items)
            items.forEach((item) => {
                if (!seen.has(item.name)) { sorted.push(item); seen.add(item.name); }
            });
            return sorted;
        } catch { return items; }
    };

    // Category collapse state — persisted per role. The category containing the
    // current page is always rendered open so the active item is never hidden.
    const collapseKey = `cims_nav_collapsed_${auth?.user?.role || 'user'}`;
    const [collapsedCats, setCollapsedCats] = useState(() => {
        try {
            const saved = JSON.parse(localStorage.getItem(collapseKey) || '[]');
            return Array.isArray(saved) ? saved : [];
        } catch { return []; }
    });
    const toggleCategory = (key) => {
        setCollapsedCats((prev) => {
            const next = prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key];
            try { localStorage.setItem(collapseKey, JSON.stringify(next)); } catch { /* private mode */ }
            return next;
        });
    };

    const [installPrompt, setInstallPrompt] = useState(null);
    const [isInstalled, setIsInstalled] = useState(
        () => typeof window !== 'undefined' && window.matchMedia('(display-mode: standalone)').matches
    );

    useEffect(() => {
        if (isInstalled) return;
        const onBefore = (e) => { e.preventDefault(); setInstallPrompt(e); };
        const onInstalled = () => { setInstallPrompt(null); setIsInstalled(true); };
        window.addEventListener('beforeinstallprompt', onBefore);
        window.addEventListener('appinstalled', onInstalled);
        return () => {
            window.removeEventListener('beforeinstallprompt', onBefore);
            window.removeEventListener('appinstalled', onInstalled);
        };
    }, [isInstalled]);

    const handleInstall = async () => {
        if (!installPrompt) return;
        installPrompt.prompt();
        const { outcome } = await installPrompt.userChoice;
        if (outcome === 'accepted') { setInstallPrompt(null); setIsInstalled(true); }
    };

    const [sidebarOpen, setSidebarOpen] = useState(true);   // desktop: expanded vs collapsed
    // Per-category item order: { [categoryKey]: item[] }
    const [catOrder, setCatOrder] = useState(() =>
        Object.fromEntries(categories.map((cat) => [cat.key, applyStoredOrder(cat.items)]))
    );
    const [reordering, setReordering] = useState(false);

    const handleReorder = (catKey, newItems) => {
        setCatOrder((prev) => {
            const next = { ...prev, [catKey]: newItems };
            try {
                // Persist as one flat list (category order is fixed, item order per category)
                const flat = categories.flatMap((cat) => next[cat.key] ?? cat.items).map((i) => i.name);
                localStorage.setItem(storageKey, JSON.stringify(flat));
            } catch {
                // Storage unavailable (private mode / quota exceeded) — the new order
                // still applies for this session, it just won't persist across reloads.
            }
            return next;
        });
    };

    const toggleReorder = () => {
        if (!reordering) setSidebarOpen(true); // auto-expand when entering reorder mode
        setReordering((r) => !r);
    };
    const [mobileOpen, setMobileOpen] = useState(false);    // mobile: overlay visible
    const [userMenuOpen, setUserMenuOpen] = useState(false);
    const [notifOpen, setNotifOpen] = useState(false);
    const [notifications, setNotifications] = useState([]);
    const [loadingNotifs, setLoadingNotifs] = useState(false);
    const [selectedNotif, setSelectedNotif] = useState(null);
    const notifRef = useRef(null);
    const currentPath = usePage().url;

    // ── Live notification state ────────────────────────────────────────────────
    // localUnreadCount is managed locally; polling keeps it in sync without
    // requiring a full Inertia page reload.
    const [localUnreadCount, setLocalUnreadCount] = useState(unreadNotifications ?? 0);
    const [bellRing, setBellRing] = useState(false);
    const prevCountRef = useRef(unreadNotifications ?? 0);

    const csrfToken = typeof document !== 'undefined' ? document.querySelector('meta[name="csrf-token"]')?.getAttribute('content') : '';

    // Close mobile sidebar on route change
    useEffect(() => {
        setMobileOpen(false);
    }, [currentPath]);

    // Ring the bell when the unread count jumps up (new notification arrived)
    useEffect(() => {
        if (localUnreadCount > prevCountRef.current) {
            setBellRing(true);
            const t = setTimeout(() => setBellRing(false), 700);
            prevCountRef.current = localUnreadCount;
            return () => clearTimeout(t);
        }
        prevCountRef.current = localUnreadCount;
    }, [localUnreadCount]);

    // Poll /notifications every 30 s.
    // Automatically pauses when the tab is hidden (saves battery on mobile).
    // Resumes with an immediate fetch when the tab becomes visible again.
    useEffect(() => {
        const POLL_MS = 30_000;
        let timer = null;

        const poll = async () => {
            try {
                const res = await fetch('/notifications', { headers: { Accept: 'application/json' } });
                if (!res.ok) return;
                const json = await res.json();
                setLocalUnreadCount(json.unread_count ?? 0);
                setNotifications(json.notifications ?? []);
            } catch { /* silent — network hiccup */ }
            timer = setTimeout(poll, POLL_MS);
        };

        const onVisibility = () => {
            if (document.visibilityState === 'visible') {
                clearTimeout(timer);
                poll(); // immediate re-fetch on tab focus
            } else {
                clearTimeout(timer); // stop ticking when hidden
            }
        };

        poll(); // first fetch on mount
        document.addEventListener('visibilitychange', onVisibility);

        return () => {
            clearTimeout(timer);
            document.removeEventListener('visibilitychange', onVisibility);
        };
    }, []); // eslint-disable-line — intentionally stable: setState setters never change

    const fetchNotifications = async () => {
        setLoadingNotifs(true);
        try {
            const res = await fetch('/notifications', { headers: { Accept: 'application/json' } });
            const json = await res.json();
            setNotifications(json.notifications || []);
            setLocalUnreadCount(json.unread_count ?? 0);
        } catch {}
        setLoadingNotifs(false);
    };

    const markAsRead = async (notif) => {
        try {
            await fetch(`/notifications/${notif.id}/read`, {
                method: 'POST',
                headers: { ...csrfHeaders(), Accept: 'application/json' },
            });
        } catch {}
        setNotifications((prev) => prev.map((n) => n.id === notif.id ? { ...n, read_at: 'now' } : n));
        if (!notif.read_at) setLocalUnreadCount((c) => Math.max(0, c - 1));
        setNotifOpen(false);
        setSelectedNotif({ ...notif, read_at: notif.read_at || 'now' });
    };

    const markAllAsRead = async () => {
        try {
            await fetch('/notifications/read-all', {
                method: 'POST',
                headers: { ...csrfHeaders(), Accept: 'application/json' },
            });
        } catch {}
        setNotifications((prev) => prev.map((n) => ({ ...n, read_at: 'now' })));
        setLocalUnreadCount(0); // instant local update — no page reload needed
    };

    useEffect(() => {
        const handleClickOutside = (e) => {
            if (notifRef.current && !notifRef.current.contains(e.target)) setNotifOpen(false);
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    return (
        <div className="min-h-screen bg-navy-950 flex">
            {/* Mobile backdrop — CSS opacity transition, no JS animation loop */}
            <div
                className={cn(
                    'fixed inset-0 z-[1100] bg-black/60 lg:hidden transition-opacity duration-200',
                    mobileOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
                )}
                onClick={() => setMobileOpen(false)}
            />

            {/* Sidebar wrapper — mobile: slide overlay, desktop: always visible */}
            <div
                className={cn(
                    'fixed inset-y-0 left-0 z-[1200] transition-transform duration-300 lg:!translate-x-0',
                    mobileOpen ? 'translate-x-0' : '-translate-x-full'
                )}
            >
                <aside className={cn(
                    'h-full bg-navy-900 border-r border-white/5 flex flex-col overflow-hidden',
                    'transition-[width] duration-200 ease-in-out',
                    sidebarOpen ? 'w-[260px]' : 'w-[72px]'
                )}>
                    {/* Logo */}
                    <div className="h-16 flex items-center px-4 border-b border-white/5">
                        <div className="flex items-center gap-3 min-w-0">
                            <div className="w-9 h-9 rounded-lg overflow-hidden shrink-0 bg-gradient-to-br from-gold-400 to-gold-600 flex items-center justify-center">
                                {companyLogoUrl
                                    ? <img src={companyLogoUrl} alt={companyName} className="w-full h-full object-contain p-0.5" />
                                    : <span className="font-bold text-navy-950 text-sm">{companyInitials}</span>
                                }
                            </div>
                            <div className={cn(
                                'overflow-hidden transition-[opacity,max-width] duration-200',
                                sidebarOpen ? 'opacity-100 max-w-[180px]' : 'opacity-0 max-w-0'
                            )}>
                                <p className="font-bold text-sm text-white whitespace-nowrap leading-tight">{companyName}</p>
                                {companyTagline && (
                                    <p className="text-[10px] text-navy-500 whitespace-nowrap leading-tight">{companyTagline}</p>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Nav — grouped into collapsible categories */}
                    <nav className="flex-1 py-3 px-3 overflow-y-auto">
                        {categories.map((cat, catIdx) => {
                            const items = catOrder[cat.key] ?? cat.items;
                            const hasActive = items.some((item) => currentPath.startsWith(item.href));
                            // Collapse only applies when the header is visible (expanded
                            // sidebar), never hides the active page, and is suspended
                            // while reordering so every item stays draggable.
                            const isCollapsed = sidebarOpen && !reordering && !hasActive
                                && collapsedCats.includes(cat.key);

                            const renderItem = (item) => {
                                const isActive = currentPath.startsWith(item.href);
                                const disabled = item.healthGated && ragDisabled;

                                if (disabled) {
                                    return (
                                        <div
                                            key={item.name}
                                            aria-disabled="true"
                                            title={ragStatus === 'unconfigured' ? 'RAG backend not configured' : 'RAG backend is offline'}
                                            className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-navy-500 opacity-50 cursor-not-allowed select-none"
                                        >
                                            <item.icon className="w-5 h-5 shrink-0" />
                                            <span className="whitespace-nowrap">{item.name}</span>
                                            {sidebarOpen && (
                                                <span className="ml-auto w-1.5 h-1.5 rounded-full bg-red-500 shrink-0" title="Offline" />
                                            )}
                                        </div>
                                    );
                                }

                                return (
                                    <Link
                                        key={item.name}
                                        href={item.href}
                                        className={cn(
                                            'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors duration-150',
                                            isActive
                                                ? 'bg-gold-500/10 text-gold-400 border border-gold-500/20'
                                                : 'text-navy-300 hover:text-white hover:bg-white/5'
                                        )}
                                    >
                                        <item.icon className="w-5 h-5 shrink-0" />
                                        <span className="whitespace-nowrap">{item.name}</span>
                                    </Link>
                                );
                            };

                            return (
                                <div key={cat.key}>
                                    {sidebarOpen ? (
                                        <button
                                            onClick={() => toggleCategory(cat.key)}
                                            className={cn(
                                                'w-full flex items-center justify-between px-3 pt-3 pb-1.5 text-[11px] font-semibold uppercase tracking-wider transition-colors',
                                                hasActive ? 'text-gold-500/80' : 'text-navy-500 hover:text-navy-300'
                                            )}
                                        >
                                            <span className="whitespace-nowrap">{cat.label}</span>
                                            <ChevronDown className={cn(
                                                'w-3.5 h-3.5 transition-transform duration-200',
                                                isCollapsed && '-rotate-90'
                                            )} />
                                        </button>
                                    ) : (
                                        // Icon-only sidebar: headers become subtle dividers
                                        catIdx > 0 && <div className="my-2 mx-2 border-t border-white/5" />
                                    )}

                                    {!isCollapsed && (reordering ? (
                                        <Reorder.Group
                                            axis="y"
                                            values={items}
                                            onReorder={(newItems) => handleReorder(cat.key, newItems)}
                                            className="space-y-1"
                                            style={{ listStyle: 'none', padding: 0, margin: 0 }}
                                        >
                                            {items.map((item) => {
                                                const isActive = currentPath.startsWith(item.href);
                                                const disabled = item.healthGated && ragDisabled;
                                                return (
                                                    <Reorder.Item
                                                        key={item.name}
                                                        value={item}
                                                        style={{ listStyle: 'none' }}
                                                        whileDrag={{ scale: 1.03, opacity: 0.9, zIndex: 50 }}
                                                        className={cn(
                                                            'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium cursor-grab active:cursor-grabbing select-none',
                                                            isActive
                                                                ? 'bg-gold-500/10 text-gold-400 border border-gold-500/20'
                                                                : 'text-navy-300 bg-navy-800/30 border border-white/5',
                                                            disabled && 'opacity-50'
                                                        )}
                                                    >
                                                        <GripVertical className="w-4 h-4 shrink-0 text-navy-500" />
                                                        <item.icon className="w-5 h-5 shrink-0" />
                                                        <span className="whitespace-nowrap">{item.name}</span>
                                                        {disabled && (
                                                            <span className="ml-auto w-1.5 h-1.5 rounded-full bg-red-500 shrink-0" title="Offline" />
                                                        )}
                                                    </Reorder.Item>
                                                );
                                            })}
                                        </Reorder.Group>
                                    ) : (
                                        <div className="space-y-1">
                                            {items.map(renderItem)}
                                        </div>
                                    ))}
                                </div>
                            );
                        })}
                    </nav>

                    {/* Footer: install + reorder + collapse */}
                    <div className="p-3 border-t border-white/5 space-y-1">
                        {/* Install App button — shown only when PWA is installable */}
                        {installPrompt && !isInstalled && (
                            <button
                                onClick={handleInstall}
                                title="Install CIMS as an app"
                                className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium transition border text-emerald-400 border-emerald-500/20 hover:bg-emerald-500/10 hover:border-emerald-500/40"
                            >
                                <Download className="w-4 h-4 shrink-0" />
                                {sidebarOpen && <span>Install App</span>}
                            </button>
                        )}
                        {/* Reorder toggle — desktop only, visible in both expanded and collapsed states */}
                        <button
                            onClick={toggleReorder}
                            title={reordering ? 'Done reordering' : 'Reorder menu items'}
                            className={cn(
                                'hidden lg:flex w-full items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium transition border',
                                reordering
                                    ? 'bg-gold-500/10 text-gold-400 border-gold-500/20'
                                    : 'text-navy-300 border-white/10 hover:text-white hover:bg-white/5 hover:border-white/20'
                            )}
                        >
                            {reordering
                                ? <><Check className="w-4 h-4 shrink-0" />{sidebarOpen && <span>Done reordering</span>}</>
                                : <><GripVertical className="w-4 h-4 shrink-0" />{sidebarOpen && <span>Reorder menu</span>}</>
                            }
                        </button>
                        {/* Desktop: collapse/expand */}
                        <button
                            onClick={() => { setSidebarOpen(!sidebarOpen); if (reordering) setReordering(false); }}
                            className="hidden lg:flex w-full items-center justify-center p-2 rounded-lg text-navy-400 hover:text-white hover:bg-white/5 transition"
                        >
                            {sidebarOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
                        </button>
                        {/* Mobile: close overlay */}
                        <button
                            onClick={() => setMobileOpen(false)}
                            className="flex lg:hidden w-full items-center justify-center p-2 rounded-lg text-navy-400 hover:text-white hover:bg-white/5 transition"
                        >
                            <X className="w-5 h-5" />
                        </button>
                    </div>
                </aside>
            </div>

            {/* Mobile install banner — shown only on small screens when PWA is installable */}
            {installPrompt && !isInstalled && (
                <div className="lg:hidden fixed bottom-4 left-4 right-4 z-50 flex items-center gap-3 px-4 py-3 bg-navy-800 border border-emerald-500/30 rounded-2xl shadow-2xl">
                    <div className="w-9 h-9 rounded-xl bg-emerald-500/10 flex items-center justify-center shrink-0">
                        <MonitorSmartphone className="w-5 h-5 text-emerald-400" />
                    </div>
                    <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-white">Install CIMS</p>
                        <p className="text-xs text-navy-400">Add to home screen for quick access</p>
                    </div>
                    <button
                        onClick={handleInstall}
                        className="shrink-0 px-3 py-1.5 bg-emerald-500/20 border border-emerald-500/30 text-emerald-400 text-xs font-semibold rounded-lg hover:bg-emerald-500/30 transition"
                    >
                        Install
                    </button>
                    <button
                        onClick={() => setInstallPrompt(null)}
                        className="shrink-0 p-1 text-navy-500 hover:text-white transition"
                    >
                        <X className="w-4 h-4" />
                    </button>
                </div>
            )}

            {/* Main content */}
            <div
                className={cn(
                    'flex-1 min-w-0 transition-[margin-left] duration-200',
                    'ml-0',
                    sidebarOpen ? 'lg:ml-[260px]' : 'lg:ml-[72px]'
                )}
            >
                {/* Header */}
                <header className="sticky top-0 z-[1000] h-16 bg-navy-950 border-b border-white/10 flex items-center justify-between px-4 lg:px-6">
                    <div className="flex items-center gap-3 min-w-0">
                        {/* Mobile hamburger */}
                        <button
                            onClick={() => setMobileOpen(true)}
                            className="p-2 rounded-lg text-navy-400 hover:text-white hover:bg-white/5 transition lg:hidden shrink-0"
                        >
                            <Menu className="w-5 h-5" />
                        </button>
                        <h1 className="text-base lg:text-lg font-semibold text-white truncate">{title}</h1>
                    </div>

                    <div className="flex items-center gap-2 lg:gap-4 shrink-0">
                        {/* Notifications */}
                        <div className="relative" ref={notifRef}>
                            <button
                                onClick={() => { setNotifOpen(!notifOpen); if (!notifOpen) fetchNotifications(); }}
                                className="relative p-2 rounded-lg text-navy-400 hover:text-white hover:bg-white/5 transition"
                            >
                                <Bell
                                    className="w-5 h-5"
                                    style={bellRing ? { animation: 'bell-ring 0.7s ease-in-out' } : {}}
                                />
                                {localUnreadCount > 0 && (
                                    <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] flex items-center justify-center px-1 bg-red-500 rounded-full text-[10px] font-bold text-white">
                                        {/* Ping overlay — visible only when a new notification just arrived */}
                                        {bellRing && (
                                            <span className="absolute inset-0 rounded-full bg-red-500 animate-ping opacity-75 pointer-events-none" />
                                        )}
                                        {localUnreadCount > 99 ? '99+' : localUnreadCount}
                                    </span>
                                )}
                            </button>

                            <div className={cn(
                                'absolute right-0 mt-2 w-[min(320px,calc(100vw-2rem))] bg-navy-800 border border-white/10 rounded-xl shadow-xl overflow-hidden z-50',
                                'transition-[opacity,transform] duration-150 origin-top-right',
                                notifOpen ? 'opacity-100 scale-100 pointer-events-auto' : 'opacity-0 scale-95 pointer-events-none invisible'
                            )}>
                                        <div className="flex items-center justify-between px-4 py-3 border-b border-white/5">
                                            <div className="flex items-center gap-2">
                                                <h3 className="text-sm font-semibold text-white">Notifications</h3>
                                                {/* Static green dot = live polling active */}
                                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" title="Auto-updates every 30 s" />
                                            </div>
                                            {notifications.some((n) => !n.read_at) && (
                                                <button onClick={markAllAsRead} className="flex items-center gap-1 text-xs text-gold-400 hover:text-gold-300 transition">
                                                    <CheckCheck className="w-3.5 h-3.5" /> Mark all read
                                                </button>
                                            )}
                                        </div>
                                        <div className="max-h-80 overflow-y-auto">
                                            {loadingNotifs ? (
                                                <p className="text-sm text-navy-400 text-center py-6">Loading...</p>
                                            ) : notifications.length > 0 ? (
                                                notifications.map((n) => {
                                                    const Icon = notifIcons[n.data?.type] || Bell;
                                                    const color = notifColors[n.data?.type] || 'text-navy-400';
                                                    return (
                                                        <button
                                                            key={n.id}
                                                            onClick={() => markAsRead(n)}
                                                            className={`w-full flex items-start gap-3 px-4 py-3 text-left hover:bg-white/5 transition border-b border-white/5 last:border-0 ${!n.read_at ? 'bg-gold-500/5' : ''}`}
                                                        >
                                                            <div className={`mt-0.5 p-1.5 rounded-lg bg-navy-700/50 ${color}`}>
                                                                <Icon className="w-4 h-4" />
                                                            </div>
                                                            <div className="flex-1 min-w-0">
                                                                <p className={`text-sm font-medium ${!n.read_at ? 'text-white' : 'text-navy-300'}`}>{n.data?.title}</p>
                                                                <p className="text-xs text-navy-400 truncate">{n.data?.message}</p>
                                                                <p className="text-[10px] text-navy-500 mt-1">{n.created_at}</p>
                                                            </div>
                                                            {!n.read_at && <span className="mt-2 w-2 h-2 bg-gold-500 rounded-full shrink-0" />}
                                                        </button>
                                                    );
                                                })
                                            ) : (
                                                <div className="text-center py-8">
                                                    <Bell className="w-8 h-8 text-navy-600 mx-auto mb-2" />
                                                    <p className="text-sm text-navy-400">No notifications</p>
                                                </div>
                                            )}
                                        </div>
                            </div>
                        </div>

                        {/* User Menu */}
                        <div className="relative">
                            <button
                                onClick={() => setUserMenuOpen(!userMenuOpen)}
                                className="flex items-center gap-2 p-2 rounded-lg hover:bg-white/5 transition"
                            >
                                <div className="w-8 h-8 rounded-full overflow-hidden shrink-0">
                                    {auth?.user?.avatar_url
                                        ? <img src={auth.user.avatar_url} alt={auth.user.name} className="w-full h-full object-cover" />
                                        : <div className="w-full h-full bg-gradient-to-br from-gold-400 to-gold-600 flex items-center justify-center text-navy-950 font-semibold text-xs">{auth?.user?.name?.charAt(0)?.toUpperCase() || 'U'}</div>
                                    }
                                </div>
                                <span className="text-sm font-medium text-white hidden sm:block">
                                    {auth?.user?.name || 'User'}
                                </span>
                                <ChevronDown className="w-4 h-4 text-navy-400 hidden sm:block" />
                            </button>

                            <div className={cn(
                                'absolute right-0 mt-2 w-48 bg-navy-800 border border-white/10 rounded-xl shadow-xl overflow-hidden',
                                'transition-[opacity,transform] duration-150 origin-top-right',
                                userMenuOpen ? 'opacity-100 scale-100 pointer-events-auto' : 'opacity-0 scale-95 pointer-events-none invisible'
                            )}>
                                        <div className="p-3 border-b border-white/5">
                                            <p className="text-sm font-medium text-white">{auth?.user?.name}</p>
                                            <p className="text-xs text-navy-400 capitalize">{auth?.user?.role}</p>
                                        </div>
                                        <div className="p-1">
                                            <Link
                                                href="/profile"
                                                className="flex items-center gap-2 px-3 py-2 text-sm text-navy-300 hover:text-white hover:bg-white/5 rounded-lg transition"
                                            >
                                                <User className="w-4 h-4" /> Profile
                                            </Link>
                                            {auth?.user?.role === 'admin' && (
                                                <Link
                                                    href="/settings/company"
                                                    className="flex items-center gap-2 px-3 py-2 text-sm text-navy-300 hover:text-white hover:bg-white/5 rounded-lg transition"
                                                >
                                                    <Settings className="w-4 h-4" /> Company Settings
                                                </Link>
                                            )}
                                            <Link
                                                href="/logout"
                                                method="post"
                                                as="button"
                                                className="w-full flex items-center gap-2 px-3 py-2 text-sm text-red-400 hover:text-red-300 hover:bg-red-500/10 rounded-lg transition"
                                            >
                                                <LogOut className="w-4 h-4" /> Logout
                                            </Link>
                                        </div>
                            </div>
                        </div>
                    </div>
                </header>

                {/* Page content */}
                <main className="p-4 lg:p-6">
                    {flash?.success && (
                        <div className="mb-4 p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
                            <p className="text-sm text-emerald-400">{flash.success}</p>
                        </div>
                    )}
                    {flash?.error && (
                        <div className="mb-4 p-3 rounded-lg bg-red-500/10 border border-red-500/20">
                            <p className="text-sm text-red-400">{flash.error}</p>
                        </div>
                    )}
                    {children}
                </main>
            </div>

            {/* Notification detail modal */}
            {selectedNotif && createPortal(
                <AnimatePresence>
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 z-[9999] bg-black/60 flex items-center justify-center p-4"
                        onClick={() => setSelectedNotif(null)}
                    >
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95, y: 10 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.95, y: 10 }}
                            transition={{ duration: 0.2 }}
                            className="w-full max-w-md bg-navy-800 border border-white/10 rounded-2xl shadow-2xl overflow-hidden"
                            onClick={(e) => e.stopPropagation()}
                        >
                            {/* Header */}
                            <div className="flex items-center justify-between px-5 py-4 border-b border-white/5">
                                <div className="flex items-center gap-3">
                                    {(() => {
                                        const Icon = notifIcons[selectedNotif.data?.type] || Bell;
                                        const color = notifColors[selectedNotif.data?.type] || 'text-navy-400';
                                        return (
                                            <div className={`p-2 rounded-xl bg-navy-700/60 ${color}`}>
                                                <Icon className="w-5 h-5" />
                                            </div>
                                        );
                                    })()}
                                    <h3 className="text-base font-semibold text-white">
                                        {selectedNotif.data?.title || 'Notification'}
                                    </h3>
                                </div>
                                <button
                                    type="button"
                                    onClick={() => setSelectedNotif(null)}
                                    className="p-1.5 rounded-lg text-navy-400 hover:text-white hover:bg-white/10 transition"
                                >
                                    <X className="w-4 h-4" />
                                </button>
                            </div>

                            {/* Body */}
                            <div className="px-5 py-4 space-y-3">
                                <p className="text-sm text-navy-200 leading-relaxed">
                                    {selectedNotif.data?.message || '-'}
                                </p>

                                {/* Extra fields */}
                                {selectedNotif.data?.details && (
                                    <p className="text-xs text-navy-400 leading-relaxed whitespace-pre-line">
                                        {selectedNotif.data.details}
                                    </p>
                                )}

                                <div className="flex items-center gap-1.5 text-xs text-navy-500 pt-1">
                                    <Clock className="w-3.5 h-3.5" />
                                    <span>{selectedNotif.created_at}</span>
                                </div>
                            </div>

                            {/* Footer */}
                            <div className="px-5 py-3 border-t border-white/5 flex items-center justify-end gap-2">
                                <button
                                    type="button"
                                    onClick={() => setSelectedNotif(null)}
                                    className="px-4 py-2 text-sm text-navy-300 hover:text-white hover:bg-white/5 rounded-lg transition"
                                >
                                    Close
                                </button>
                                {selectedNotif.data?.url && (
                                    <button
                                        type="button"
                                        onClick={() => { setSelectedNotif(null); router.visit(selectedNotif.data.url); }}
                                        className="flex items-center gap-2 px-4 py-2 text-sm font-medium bg-gold-500/10 text-gold-400 hover:bg-gold-500/20 rounded-lg transition"
                                    >
                                        <ExternalLink className="w-4 h-4" />
                                        View Details
                                    </button>
                                )}
                            </div>
                        </motion.div>
                    </motion.div>
                </AnimatePresence>,
                document.body
            )}
        </div>
    );
}
