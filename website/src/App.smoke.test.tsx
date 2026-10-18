import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import App from './App';

describe('website scaffold', () => {
  it('renders the app root', () => {
    render(<App />);
    expect(screen.getByTestId('app-root')).toBeInTheDocument();
  });
});
