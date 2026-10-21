import * as React from 'react';
import { motion } from 'framer-motion';
import { motionTransitions } from '../../lib/motion-tokens';
import { cn } from '../../lib/utils';

export interface ProgressRingProps {
  /** 0–100 */
  value: number;
  size?: number;
  strokeWidth?: number;
  /** Tailwind text color class; the arc uses currentColor. */
  className?: string;
  children?: React.ReactNode;
}

export function ProgressRing({ value, size = 264, strokeWidth = 6, className, children }: ProgressRingProps) {
  const r = (size - strokeWidth) / 2;
  const c = 2 * Math.PI * r;
  const clamped = Math.min(100, Math.max(0, value));
  return (
    <div
      data-testid="progress"
      data-value={Math.round(clamped)}
      className="relative grid place-items-center"
      style={{ width: size, height: size, maxWidth: '100%' }}
    >
      <svg viewBox={`0 0 ${size} ${size}`} className="absolute inset-0 size-full -rotate-90" aria-hidden="true">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" strokeWidth={strokeWidth} className="stroke-border" />
        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={c}
          initial={false}
          animate={{ strokeDashoffset: c * (1 - clamped / 100) }}
          transition={motionTransitions.easeSoft}
          className={cn('stroke-current', className)}
        />
      </svg>
      <div className="relative flex flex-col items-center">{children}</div>
    </div>
  );
}
