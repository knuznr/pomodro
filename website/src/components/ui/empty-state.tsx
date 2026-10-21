import * as React from 'react';
import { cn } from '../../lib/utils';

export function EmptyState({
  icon,
  children,
  className,
}: {
  icon?: React.ReactNode;
  children?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        'flex flex-col items-center gap-2 rounded-xl border border-dashed border-border px-4 py-6 text-sm text-text-muted',
        className,
      )}
    >
      {icon && <span className="text-text-subtle">{icon}</span>}
      {children}
    </div>
  );
}
