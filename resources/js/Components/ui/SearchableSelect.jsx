import { cn } from '@/Lib/utils';
import { useState, useRef, useEffect, useId } from 'react';
import { createPortal } from 'react-dom';
import { ChevronDown, Search, X } from 'lucide-react';

// options: [{ value, label, searchText? }]
// searchText: extra hidden text to match against (e.g. kode_barang + spesifikasi)
export default function SearchableSelect({ label, value, onChange, options = [], placeholder = 'Select...', error, className }) {
    const id = useId();
    const [open, setOpen] = useState(false);
    const [query, setQuery] = useState('');
    const [dropdownStyle, setDropdownStyle] = useState({});
    const ref = useRef(null);
    const buttonRef = useRef(null);
    const inputRef = useRef(null);

    const selected = options.find((o) => String(o.value) === String(value));

    const filtered = options.filter((o) => {
        if (!query) return true;
        const q = query.toLowerCase();
        const haystack = (o.searchText ? `${o.label} ${o.searchText}` : o.label).toLowerCase();
        return haystack.includes(q);
    });

    const reposition = () => {
        if (!buttonRef.current) return;
        const rect = buttonRef.current.getBoundingClientRect();
        const spaceBelow = window.innerHeight - rect.bottom;
        const dropHeight = 256;
        const openAbove = spaceBelow < dropHeight && rect.top > spaceBelow;

        setDropdownStyle({
            position: 'fixed',
            left: rect.left,
            width: rect.width,
            zIndex: 9999,
            ...(openAbove
                ? { bottom: window.innerHeight - rect.top + 4 }
                : { top: rect.bottom + 4 }),
        });
    };

    useEffect(() => {
        if (open) {
            reposition();
            window.addEventListener('scroll', reposition, true);
            window.addEventListener('resize', reposition);
        }
        return () => {
            window.removeEventListener('scroll', reposition, true);
            window.removeEventListener('resize', reposition);
        };
    }, [open]);

    useEffect(() => {
        const handleClickOutside = (e) => {
            const portal = document.getElementById(`ss-portal-${id}`);
            if (
                ref.current && !ref.current.contains(e.target) &&
                !portal?.contains(e.target)
            ) {
                setOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [id]);

    useEffect(() => {
        if (open && inputRef.current) inputRef.current.focus();
    }, [open]);

    const handleSelect = (val) => {
        onChange({ target: { value: val } });
        setOpen(false);
        setQuery('');
    };

    const handleClear = (e) => {
        e.stopPropagation();
        onChange({ target: { value: '' } });
        setQuery('');
    };

    const dropdown = open && (
        <div
            id={`ss-portal-${id}`}
            style={dropdownStyle}
            className="bg-navy-800 border border-white/10 rounded-xl shadow-2xl overflow-hidden"
        >
            <div className="p-2 border-b border-white/5">
                <div className="relative">
                    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-navy-400" />
                    <input
                        ref={inputRef}
                        type="text"
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        placeholder="Type to search..."
                        className="w-full pl-8 pr-3 py-2 bg-navy-900/50 border border-white/5 rounded-lg text-sm text-white placeholder-navy-500 focus:outline-none focus:ring-1 focus:ring-gold-500/30"
                    />
                </div>
            </div>
            <div className="max-h-56 overflow-y-auto">
                {filtered.length > 0 ? filtered.map((opt) => (
                    <button
                        key={opt.value}
                        type="button"
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={() => handleSelect(opt.value)}
                        className={cn(
                            'w-full text-left px-4 py-2 text-sm transition hover:bg-white/5',
                            String(opt.value) === String(value)
                                ? 'text-gold-400 bg-gold-500/5'
                                : 'text-navy-200',
                        )}
                    >
                        {opt.label}
                        {opt.sub && (
                            <span className="block text-xs text-navy-500 mt-0.5">{opt.sub}</span>
                        )}
                    </button>
                )) : (
                    <p className="px-4 py-3 text-sm text-navy-500 text-center">No results found</p>
                )}
            </div>
        </div>
    );

    return (
        <div className="space-y-1.5" ref={ref}>
            {label && <label className="block text-sm font-medium text-navy-200">{label}</label>}
            <div className="relative">
                <button
                    ref={buttonRef}
                    type="button"
                    onClick={() => setOpen(!open)}
                    className={cn(
                        'w-full flex items-center justify-between px-4 py-2.5 bg-navy-800/50 border rounded-lg text-sm transition-all',
                        'focus:outline-none focus:ring-2 focus:ring-gold-500/30 focus:border-gold-500/50',
                        error ? 'border-red-500/50' : 'border-white/10',
                        selected ? 'text-white' : 'text-navy-500',
                        className,
                    )}
                >
                    <span className="truncate">{selected ? selected.label : placeholder}</span>
                    <div className="flex items-center gap-1 shrink-0">
                        {selected && (
                            <span onClick={handleClear} className="p-0.5 hover:bg-white/10 rounded transition">
                                <X className="w-3.5 h-3.5 text-navy-400" />
                            </span>
                        )}
                        <ChevronDown className={cn('w-4 h-4 text-navy-400 transition-transform', open && 'rotate-180')} />
                    </div>
                </button>

                {typeof document !== 'undefined' && createPortal(dropdown, document.body)}
            </div>
            {error && <p className="text-xs text-red-400">{error}</p>}
        </div>
    );
}
