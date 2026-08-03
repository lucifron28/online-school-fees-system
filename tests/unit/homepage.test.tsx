import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import HomePage from '@/app/page';

describe('HomePage Foundation Component', () => {
  it('renders project title and 20-screen reference hub', () => {
    render(<HomePage />);

    expect(screen.getByText('Online School Fees Monitoring & Payment System')).toBeInTheDocument();

    expect(screen.getByText(/20 \/ 20 Reference Screens Scaffolded/i)).toBeInTheDocument();
  });
});
