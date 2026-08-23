import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { LoginForm } from '@/components/auth/login-form';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace: vi.fn() }),
}));

vi.mock('@/lib/auth/client', () => ({
  signIn: { email: vi.fn() },
  signOut: vi.fn(),
}));

describe('LoginForm Password Show/Hide Control', () => {
  it('renders password field with type="password" by default', () => {
    render(
      <LoginForm
        portal="admin"
        defaultEmail="admin@demo.school"
        buttonLabel="Sign in"
        accentClass="bg-blue-600"
        linkClass="text-blue-700"
        focusClass="focus-ring"
      />
    );

    const passwordInput = screen.getByPlaceholderText('Enter password');
    expect(passwordInput).toHaveAttribute('type', 'password');

    const toggleButton = screen.getByRole('button', { name: 'Show password' });
    expect(toggleButton).toBeInTheDocument();
    expect(toggleButton).toHaveAttribute('type', 'button');
  });

  it('toggles password visibility between password and text when clicked', async () => {
    const user = userEvent.setup();
    render(
      <LoginForm
        portal="parent"
        defaultEmail="parent@demo.school"
        buttonLabel="Sign in"
        accentClass="bg-teal-600"
        linkClass="text-teal-700"
        focusClass="focus-ring"
      />
    );

    const passwordInput = screen.getByPlaceholderText('Enter password');
    const toggleButton = screen.getByRole('button', { name: 'Show password' });

    expect(passwordInput).toHaveAttribute('type', 'password');

    await user.click(toggleButton);

    expect(passwordInput).toHaveAttribute('type', 'text');
    expect(screen.getByRole('button', { name: 'Hide password' })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Hide password' }));

    expect(passwordInput).toHaveAttribute('type', 'password');
    expect(screen.getByRole('button', { name: 'Show password' })).toBeInTheDocument();
  });
});
