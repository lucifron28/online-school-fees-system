import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import HomePage from '@/app/page';

describe('HomePage Foundation Component', () => {
  it('renders project title and foundation ready status', () => {
    render(<HomePage />);

    expect(
      screen.getByText('Online School Fees Monitoring and Payment Information System')
    ).toBeInTheDocument();

    expect(screen.getByText('System Foundation Ready')).toBeInTheDocument();
    expect(screen.getByText(/Mother Perpetua Parochial School/i)).toBeInTheDocument();
  });
});
