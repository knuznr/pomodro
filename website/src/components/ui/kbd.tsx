import * as React from 'react';
import { cn } from '../../lib/utils';

/** Decorative key hint; hidden from assistive tech so button names stay clean. */
export function Kbd({ className, ...props }: React.ComponentProps<'kbd'>) {
  return (
    <kbd
      aria-hidden="true"
      className={cn(
        'hidden h-5 min-w-5 items-center justify-center rounded border border-border bg-surface-raised px-1 font-mono text-[10px] font-medium text-text-muted sm:inline-flex',
        className,
      )}
      {...props}
    />
  );
}
