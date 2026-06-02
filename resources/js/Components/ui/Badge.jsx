import { cn } from '@/Lib/utils';

export default function Badge({ className, children, ...props }) {
    return (
        <span
            className={cn(
                'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border',
                className,
            )}
            {...props}
        >
            {children}
        </span>
    );
}
