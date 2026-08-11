import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import HomePage from '@/app/page';

describe('HomePage Foundation Component', () => {
  it('renders the payment-monitoring headline and workspace map', () => {
    render(<HomePage />);

    expect(
      screen.getByRole('heading', {
        name: 'Keep every fee, payment, and receipt in one clear record.',
      })
    ).toBeInTheDocument();

    expect(screen.getByRole('link', { name: /Open administrator portal/i })).toHaveAttribute(
      'href',
      '/login/admin'
    );
    expect(screen.getByRole('heading', { name: 'Explore the main views.' })).toBeInTheDocument();
  });
});
