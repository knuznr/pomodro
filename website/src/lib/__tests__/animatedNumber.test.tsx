import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { AnimatedNumber } from '@/components/ui/animated-number';

describe('AnimatedNumber pad option', () => {
  it('zero-pads a small value when pad is set', () => {
    const { container } = render(<AnimatedNumber value={5} pad={2} useGrouping={false} />);
    expect(container.querySelector('[aria-label]')?.getAttribute('aria-label')).toBe('05');
  });

  it('leaves two-digit values unchanged and stays backward compatible', () => {
    const { container } = render(<AnimatedNumber value={25} />);
    expect(container.querySelector('[aria-label]')?.getAttribute('aria-label')).toBe('25');
  });

  it('does not pad when the pad option is absent', () => {
    const { container } = render(<AnimatedNumber value={5} />);
    expect(container.querySelector('[aria-label]')?.getAttribute('aria-label')).toBe('5');
  });
});
