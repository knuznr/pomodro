import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { LanguageToggle } from '@/components/pomodoro/LanguageToggle';

describe('LanguageToggle', () => {
  it('marks the active language and emits the clicked one', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<LanguageToggle lang="tr" onChange={onChange} />);
    const trButton = screen.getByText('TR').closest('button');
    const enButton = screen.getByText('EN').closest('button');
    // The installed AnimatedTabs marks the active tab with a motion indicator
    // <div> rendered only inside the active button; there is no data-state
    // attribute anywhere in its markup, so the active marker is asserted on
    // that indicator instead (brief sanctions adapting this single assertion).
    expect(trButton?.querySelector('div')).not.toBeNull();
    expect(enButton?.querySelector('div')).toBeNull();
    await user.click(screen.getByText('EN'));
    expect(onChange).toHaveBeenCalledWith('en');
  });
});
