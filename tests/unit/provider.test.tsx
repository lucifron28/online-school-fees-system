import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { QueryProvider } from '@/lib/query/provider';

describe('QueryProvider', () => {
  it('renders children correctly', () => {
    render(
      <QueryProvider>
        <div>Test Child Component</div>
      </QueryProvider>
    );

    expect(screen.getByText('Test Child Component')).toBeInTheDocument();
  });
});
