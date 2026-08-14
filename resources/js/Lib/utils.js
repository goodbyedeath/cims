import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs) {
    return twMerge(clsx(inputs));
}

export function formatCurrency(amount) {
    const n = Math.round(parseFloat(amount) || 0);
    return 'Rp ' + n.toLocaleString('id-ID', { maximumFractionDigits: 0 });
}

export function formatNumber(num) {
    return new Intl.NumberFormat('id-ID').format(num);
}

// Compact Indonesian currency: 1.430.000 → "1,43 jt", 320.000.000 → "320 jt", 1.600.000.000 → "1,6 M"
export function formatCompact(amount) {
    const n = parseFloat(amount) || 0;
    const fmt = (val, maxDec = 2) => {
        const trimmed = parseFloat(val.toFixed(maxDec));
        return trimmed.toString().replace('.', ',');
    };
    if (n >= 1_000_000_000) return fmt(n / 1_000_000_000) + ' M';
    if (n >= 1_000_000)     return fmt(n / 1_000_000) + ' jt';
    if (n >= 1_000)         return fmt(n / 1_000, 1) + ' rb';
    return n.toLocaleString('id-ID');
}

export function formatDate(date) {
    if (!date) return '-';
    return new Date(date).toLocaleDateString('id-ID', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
    });
}

export function gradeColor(grade) {
    const colors = {
        platinum: 'bg-purple-500/20 text-purple-300 border-purple-500/30',
        gold: 'bg-gold-500/20 text-gold-300 border-gold-500/30',
        silver: 'bg-gray-400/20 text-gray-300 border-gray-400/30',
        risk: 'bg-red-500/20 text-red-300 border-red-500/30',
    };
    return colors[grade] || colors.risk;
}

export function statusColor(status) {
    const colors = {
        active: 'bg-emerald-500/20 text-emerald-300',
        inactive: 'bg-gray-500/20 text-gray-300',
        blacklist: 'bg-red-500/20 text-red-300',
        pending: 'bg-yellow-500/20 text-yellow-300',
        confirmed: 'bg-blue-500/20 text-blue-300',
        process: 'bg-indigo-500/20 text-indigo-300',
        delivered: 'bg-emerald-500/20 text-emerald-300',
        cancel: 'bg-red-500/20 text-red-300',
        paid: 'bg-emerald-500/20 text-emerald-300',
        unpaid: 'bg-red-500/20 text-red-300',
        partial: 'bg-yellow-500/20 text-yellow-300',
        late: 'bg-orange-500/20 text-orange-300',
        cancelled: 'bg-gray-500/20 text-gray-400 line-through',
        draft: 'bg-gray-500/20 text-gray-300',
        sent: 'bg-blue-500/20 text-blue-300',
        accepted: 'bg-emerald-500/20 text-emerald-300',
        rejected: 'bg-red-500/20 text-red-300',
        expired: 'bg-orange-500/20 text-orange-300',
    };
    return colors[status] || 'bg-gray-500/20 text-gray-300';
}

// CSRF header for raw fetch() calls. Prefer the XSRF-TOKEN cookie — Laravel
// refreshes it on every response, so it survives session regeneration (partner
// PIN login) and session expiry. The <meta name="csrf-token"> tag is only
// rendered on the first full page load; once the session rotates, that value
// is stale and every POST using it gets 419 "CSRF token mismatch".
export function csrfHeaders() {
    if (typeof document === 'undefined') return {};
    const cookie = document.cookie.match(/(?:^|;\s*)XSRF-TOKEN=([^;]+)/);
    if (cookie) return { 'X-XSRF-TOKEN': decodeURIComponent(cookie[1]) };
    const meta = document.querySelector('meta[name="csrf-token"]')?.getAttribute('content');
    return meta ? { 'X-CSRF-TOKEN': meta } : {};
}
