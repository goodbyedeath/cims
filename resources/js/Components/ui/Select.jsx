import { cn } from '@/Lib/utils';
import { forwardRef } from 'react';

const Select = forwardRef(({ className, label, error, options = [], placeholder, ...props }, ref) => (
    <div className="space-y-1.5">
        {label && <label className="block text-sm font-medium text-navy-200">{label}</label>}
        <select
            ref={ref}
            className={cn(
                'w-full px-4 py-2.5 bg-navy-800/50 border rounded-lg text-white text-sm',
                'focus:outline-none focus:ring-2 focus:ring-gold-500/30 focus:border-gold-500/50 transition-all appearance-none',
                error ? 'border-red-500/50' : 'border-white/10',
                className,
            )}
            {...props}
        >
            {placeholder && <option value="">{placeholder}</option>}
            {options.map((opt) => (
                <option key={opt.value} value={opt.value} className="bg-navy-800">
                    {opt.label}
                </option>
            ))}
        </select>
        {error && <p className="text-xs text-red-400">{error}</p>}
    </div>
));

Select.displayName = 'Select';
export default Select;
