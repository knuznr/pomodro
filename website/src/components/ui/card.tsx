import * as React from 'react';
import { cn } from '../../lib/utils';

/** EasyUI surface: 1px border, raised dark fill, soft top highlight. */
export function Card({ className, ...props }: React.ComponentProps<'section'>) {
  return (
    <section
      className={cn(
        'rounded-2xl border border-border bg-surface shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]',
        className,
      )}
      {...props}
    />
  );
}

export function CardHeader({ className, ...props }: React.ComponentProps<'div'>) {
  return <div className={cn('flex items-center justify-between gap-3 px-5 pt-4', className)} {...props} />;
}

export function CardTitle({ className, ...props }: React.ComponentProps<'h2'>) {
  return <h2 className={cn('text-sm font-semibold text-text-primary', className)} {...props} />;
}

export function CardContent({ className, ...props }: React.ComponentProps<'div'>) {
  return <div className={cn('p-5', className)} {...props} />;
}
