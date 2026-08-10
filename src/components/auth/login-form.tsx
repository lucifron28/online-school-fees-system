'use client';

import { useForm } from '@tanstack/react-form';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { z } from 'zod/v3';
import { signIn, signOut } from '@/lib/auth/client';
import { getRoleLandingPath, parseUserRole } from '@/lib/auth/roles';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ArrowRight } from 'lucide-react';

const loginSchema = z.object({
  email: z.string().email('Enter a valid email address.'),
  password: z.string().min(1, 'Enter your password.'),
  rememberMe: z.boolean(),
});

type LoginPortal = 'admin' | 'parent' | 'student';

interface LoginFormProps {
  portal: LoginPortal;
  defaultEmail: string;
  buttonLabel: string;
  accentClass: string;
  linkClass: string;
  focusClass: string;
}

function fieldError(errors: unknown[]): string | null {
  const error = errors[0];
  if (!error) return null;
  if (typeof error === 'string') return error;
  if (typeof error === 'object' && error !== null && 'message' in error) {
    return String(error.message);
  }
  return String(error);
}

function authErrorMessage(error: unknown): string {
  if (typeof error === 'object' && error !== null && 'message' in error) {
    const message = String(error.message);
    if (message.toLowerCase().includes('disabled')) return 'This account is disabled.';
    if (message.toLowerCase().includes('invalid')) return 'Invalid email or password.';
    return 'Unable to sign in. Check your credentials and try again.';
  }
  return 'Unable to sign in. Check your credentials and try again.';
}

export function LoginForm({
  portal,
  defaultEmail,
  buttonLabel,
  accentClass,
  linkClass,
  focusClass,
}: LoginFormProps) {
  const router = useRouter();
  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const form = useForm({
    defaultValues: {
      email: defaultEmail,
      password: '',
      rememberMe: true,
    },
    validators: {
      onSubmit: loginSchema,
    },
    onSubmit: async ({ value }) => {
      setFormError(null);
      setIsSubmitting(true);

      try {
        // The destination comes only from the stored role; no callback URL is accepted.
        const result = await signIn.email({
          email: value.email,
          password: value.password,
          rememberMe: value.rememberMe,
        });

        if (result.error) throw result.error;

        const role = parseUserRole(
          (result.data?.user as Record<string, unknown> | undefined)?.role
        );
        if (!role) {
          await signOut();
          throw new Error('Your account has no valid portal role.');
        }

        router.replace(getRoleLandingPath(role));
      } catch (error) {
        setFormError(authErrorMessage(error));
      } finally {
        setIsSubmitting(false);
      }
    },
  });

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        void form.handleSubmit();
      }}
      className="mt-8 space-y-4"
      noValidate
    >
      <div>
        <label
          htmlFor={`${portal}-email`}
          className="mb-1 block text-xs font-semibold text-slate-700 dark:text-slate-300"
        >
          {portal === 'admin'
            ? 'Email / Admin ID'
            : portal === 'parent'
              ? 'Parent Email / Account ID'
              : 'Student Email / Account ID'}
        </label>
        <form.Field name="email">
          {(field) => {
            const error = fieldError(field.state.meta.errors);
            return (
              <>
                <Input
                  id={`${portal}-email`}
                  name={field.name}
                  type="email"
                  placeholder={portal === 'admin' ? 'admin@demo.school' : `${portal}@demo.school`}
                  value={field.state.value}
                  onChange={(event) => field.handleChange(event.target.value)}
                  onBlur={field.handleBlur}
                  className={`h-11 text-sm ${focusClass}`}
                  autoComplete="username"
                  aria-invalid={Boolean(error)}
                />
                {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
              </>
            );
          }}
        </form.Field>
      </div>

      <div>
        <div className="mb-1 flex items-center justify-between">
          <label
            htmlFor={`${portal}-password`}
            className="block text-xs font-semibold text-slate-700 dark:text-slate-300"
          >
            Password
          </label>
          <button
            type="button"
            onClick={() => setFormError('Password reset is managed by the School Administrator.')}
            className={`min-h-10 rounded-md px-2 text-xs ${linkClass} hover:bg-accent hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring`}
          >
            Forgot Password?
          </button>
        </div>
        <form.Field name="password">
          {(field) => {
            const error = fieldError(field.state.meta.errors);
            return (
              <>
                <Input
                  id={`${portal}-password`}
                  name={field.name}
                  type="password"
                  placeholder="Enter password"
                  value={field.state.value}
                  onChange={(event) => field.handleChange(event.target.value)}
                  onBlur={field.handleBlur}
                  className={`h-11 text-sm ${focusClass}`}
                  autoComplete="current-password"
                  aria-invalid={Boolean(error)}
                />
                {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
              </>
            );
          }}
        </form.Field>
      </div>

      <form.Field name="rememberMe">
        {(field) => (
          <div className="flex items-center space-x-2">
            <input
              type="checkbox"
              id={`${portal}-remember`}
              checked={field.state.value}
              onChange={(event) => field.handleChange(event.target.checked)}
              className="h-5 w-5 rounded border-slate-300 text-blue-600 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
            />
            <label
              htmlFor={`${portal}-remember`}
              className="text-xs text-slate-600 dark:text-slate-400"
            >
              Remember me
            </label>
          </div>
        )}
      </form.Field>

      {formError && (
        <p
          role="alert"
          className="rounded-md bg-red-50 px-3 py-2 text-xs text-red-700 dark:bg-red-950/40 dark:text-red-300"
        >
          {formError}
        </p>
      )}

      <Button
        type="submit"
        disabled={isSubmitting}
        className={`h-11 w-full text-sm font-medium text-white shadow-sm ${accentClass}`}
      >
        <span>{isSubmitting ? 'Signing in…' : buttonLabel}</span>
        <ArrowRight className="ml-2 h-4 w-4" />
      </Button>
    </form>
  );
}
