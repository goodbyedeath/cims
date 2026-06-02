import { cn } from '@/Lib/utils';

export function Table({ className, children }) {
    return (
        <div className="overflow-x-auto rounded-xl border border-white/5">
            <table className={cn('w-full text-sm', className)}>{children}</table>
        </div>
    );
}

export function Thead({ children }) {
    return <thead className="bg-navy-800/50 border-b border-white/5">{children}</thead>;
}

export function Th({ className, children, ...props }) {
    return (
        <th className={cn('px-4 py-3 text-left text-xs font-semibold text-navy-300 uppercase tracking-wider', className)} {...props}>
            {children}
        </th>
    );
}

export function Tbody({ children }) {
    return <tbody className="divide-y divide-white/5">{children}</tbody>;
}

export function Tr({ className, children, ...props }) {
    return (
        <tr className={cn('hover:bg-white/[0.02] transition-colors', className)} {...props}>
            {children}
        </tr>
    );
}

export function Td({ className, children, ...props }) {
    return (
        <td className={cn('px-4 py-3 text-sm text-navy-200', className)} {...props}>
            {children}
        </td>
    );
}

export function ThSortable({ field, sort_by, sort_dir, onSort, children, className }) {
    const active = sort_by === field;
    const nextDir = active && sort_dir === 'asc' ? 'desc' : 'asc';
    return (
        <th
            onClick={() => onSort(field, nextDir)}
            className={cn(
                'px-4 py-3 text-left text-xs font-semibold text-navy-300 uppercase tracking-wider cursor-pointer select-none group',
                'hover:text-white transition-colors',
                className
            )}
        >
            <span className="flex items-center gap-1.5">
                {children}
                <span className={`flex flex-col -space-y-0.5 transition-opacity ${active ? 'opacity-100' : 'opacity-25 group-hover:opacity-60'}`}>
                    <svg viewBox="0 0 8 5" className={`w-2 h-2 ${active && sort_dir === 'asc' ? 'text-gold-400' : 'text-current'}`} fill="currentColor"><path d="M4 0L8 5H0z"/></svg>
                    <svg viewBox="0 0 8 5" className={`w-2 h-2 ${active && sort_dir === 'desc' ? 'text-gold-400' : 'text-current'}`} fill="currentColor"><path d="M4 5L0 0H8z"/></svg>
                </span>
            </span>
        </th>
    );
}
