import { Minus, Plus } from 'lucide-react';
import { Button } from './button';
import { cn } from '../../lib/utils';

export interface NumberStepperProps {
  value: number;
  min: number;
  max: number;
  onChange: (value: number) => void;
  decreaseLabel: string;
  increaseLabel: string;
  className?: string;
}

export function NumberStepper({ value, min, max, onChange, decreaseLabel, increaseLabel, className }: NumberStepperProps) {
  return (
    <div className={cn('inline-flex items-center gap-1', className)}>
      <Button variant="outline" size="sm" className="size-8 px-0" aria-label={decreaseLabel} disabled={value <= min} onClick={() => onChange(value - 1)}>
        <Minus className="size-3.5" />
      </Button>
      <span className="w-8 text-center font-mono text-sm tabular-nums text-text-primary">{value}</span>
      <Button variant="outline" size="sm" className="size-8 px-0" aria-label={increaseLabel} disabled={value >= max} onClick={() => onChange(value + 1)}>
        <Plus className="size-3.5" />
      </Button>
    </div>
  );
}
