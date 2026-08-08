'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus, RefreshCw, Save, Shield, UserCheck, UserX, X } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { Input } from '@/components/ui/input';
import { LoadingState } from '@/components/ui/loading-state';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { USER_ROLES, type UserRole } from '@/lib/auth/roles';

type AdministrationUser = {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  active: boolean;
  createdAt: string;
};

type UserUpdate = {
  role?: UserRole;
  active?: boolean;
};

type CreateUserForm = {
  name: string;
  email: string;
  password: string;
  role: UserRole;
};

async function requestJson<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    ...init,
    credentials: 'same-origin',
    headers: {
      'Content-Type': 'application/json',
      ...(init?.headers ?? {}),
    },
  });
  const payload = (await response.json().catch(() => null)) as
    { error?: string; message?: string } | T | null;

  if (!response.ok) {
    const errorPayload = payload as { error?: string; message?: string } | null;
    throw new Error(errorPayload?.error ?? errorPayload?.message ?? 'The request failed.');
  }

  return payload as T;
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : 'The request failed.';
}

function roleClass(role: UserRole) {
  if (role === 'ADMIN') return 'border-blue-200 bg-blue-50 text-blue-700';
  if (role === 'FINANCE_STAFF') return 'border-emerald-200 bg-emerald-50 text-emerald-700';
  if (role === 'PARENT') return 'border-amber-200 bg-amber-50 text-amber-700';
  return 'border-purple-200 bg-purple-50 text-purple-700';
}

function formatCreatedAt(value: string) {
  return new Intl.DateTimeFormat('en-PH', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  }).format(new Date(value));
}

export function UserManagement() {
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedRole, setSelectedRole] = useState<'ALL' | UserRole>('ALL');
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [requestError, setRequestError] = useState<string | null>(null);
  const [form, setForm] = useState<CreateUserForm>({
    name: '',
    email: '',
    password: '',
    role: 'PARENT',
  });

  const usersQuery = useQuery<AdministrationUser[]>({
    queryKey: ['admin-users'],
    queryFn: () => requestJson<AdministrationUser[]>('/api/admin/users'),
  });

  const createMutation = useMutation({
    mutationFn: (input: CreateUserForm) =>
      requestJson<AdministrationUser>('/api/admin/users', {
        method: 'POST',
        body: JSON.stringify(input),
      }),
    onSuccess: () => {
      setForm({ name: '', email: '', password: '', role: 'PARENT' });
      setShowCreateForm(false);
      setRequestError(null);
      setNotice('User account created successfully.');
      void queryClient.invalidateQueries({ queryKey: ['admin-users'] });
    },
    onError: (error) => {
      setNotice(null);
      setRequestError(errorMessage(error));
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, input }: { id: string; input: UserUpdate }) =>
      requestJson<AdministrationUser>(`/api/admin/users/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(input),
      }),
    onSuccess: () => {
      setRequestError(null);
      setNotice('User account updated successfully.');
      void queryClient.invalidateQueries({ queryKey: ['admin-users'] });
    },
    onError: (error) => {
      setNotice(null);
      setRequestError(errorMessage(error));
    },
  });

  const filteredUsers = useMemo(() => {
    const users = usersQuery.data ?? [];
    const normalizedSearch = searchTerm.trim().toLowerCase();
    return users.filter((user) => {
      const matchesSearch =
        !normalizedSearch ||
        user.name.toLowerCase().includes(normalizedSearch) ||
        user.email.toLowerCase().includes(normalizedSearch);
      const matchesRole = selectedRole === 'ALL' || user.role === selectedRole;
      return matchesSearch && matchesRole;
    });
  }, [searchTerm, selectedRole, usersQuery.data]);

  const submitCreate = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setNotice(null);
    setRequestError(null);
    createMutation.mutate(form);
  };

  const updateRole = (user: AdministrationUser, role: UserRole) => {
    if (role === user.role) return;
    if (!window.confirm(`Change ${user.name}'s role to ${role}?`)) return;
    setNotice(null);
    setRequestError(null);
    updateMutation.mutate({ id: user.id, input: { role } });
  };

  const updateStatus = (user: AdministrationUser) => {
    const nextActive = !user.active;
    if (!nextActive && !window.confirm(`Disable ${user.name}'s account?`)) return;
    setNotice(null);
    setRequestError(null);
    updateMutation.mutate({ id: user.id, input: { active: nextActive } });
  };

  if (usersQuery.isPending) {
    return <LoadingState label="Loading system user accounts..." />;
  }

  if (usersQuery.isError || !usersQuery.data) {
    return (
      <EmptyState
        title="User accounts could not be loaded"
        description={usersQuery.error?.message ?? 'The user directory is unavailable.'}
        actionLabel="Retry"
        onAction={() => void usersQuery.refetch()}
      />
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <Badge variant="outline" className="border-blue-200 bg-blue-50 text-blue-700">
            Admin - USER MANAGEMENT
          </Badge>
          <h2 className="mt-1 text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
            System User Accounts
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Create accounts, assign roles, and control portal access.
          </p>
        </div>
        <Button
          type="button"
          className="h-9 bg-blue-600 text-xs text-white hover:bg-blue-700"
          onClick={() => {
            setShowCreateForm((current) => !current);
            setRequestError(null);
          }}
        >
          {showCreateForm ? <X className="mr-1.5 h-4 w-4" /> : <Plus className="mr-1.5 h-4 w-4" />}
          {showCreateForm ? 'Close form' : 'Create user account'}
        </Button>
      </div>

      {(notice || requestError) && (
        <div
          role={requestError ? 'alert' : 'status'}
          className={`rounded-lg border px-4 py-3 text-sm ${
            requestError
              ? 'border-rose-200 bg-rose-50 text-rose-700'
              : 'border-emerald-200 bg-emerald-50 text-emerald-700'
          }`}
        >
          {requestError ?? notice}
        </div>
      )}

      {showCreateForm && (
        <Card className="border-blue-200 shadow-sm dark:border-blue-900">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-sm">
              <Shield className="h-4 w-4 text-blue-600" /> Create a supported portal account
            </CardTitle>
          </CardHeader>
          <CardContent>
            <form className="grid gap-4 md:grid-cols-2" onSubmit={submitCreate}>
              <Field label="Full name">
                <Input
                  required
                  minLength={2}
                  value={form.name}
                  onChange={(event) =>
                    setForm((current) => ({ ...current, name: event.target.value }))
                  }
                  placeholder="Maria Santos"
                />
              </Field>
              <Field label="Email address">
                <Input
                  required
                  type="email"
                  value={form.email}
                  onChange={(event) =>
                    setForm((current) => ({ ...current, email: event.target.value }))
                  }
                  placeholder="maria@school.edu"
                />
              </Field>
              <Field label="Temporary password">
                <Input
                  required
                  minLength={8}
                  type="password"
                  value={form.password}
                  onChange={(event) =>
                    setForm((current) => ({ ...current, password: event.target.value }))
                  }
                  placeholder="At least 8 characters"
                />
              </Field>
              <Field label="Portal role">
                <select
                  required
                  value={form.role}
                  onChange={(event) =>
                    setForm((current) => ({ ...current, role: event.target.value as UserRole }))
                  }
                  className="flex h-9 w-full rounded-md border border-slate-200 bg-white px-3 text-sm dark:border-slate-800 dark:bg-slate-900"
                >
                  {USER_ROLES.map((role) => (
                    <option key={role} value={role}>
                      {role}
                    </option>
                  ))}
                </select>
              </Field>
              <div className="flex items-center gap-2 md:col-span-2">
                <Button
                  type="submit"
                  disabled={createMutation.isPending}
                  className="bg-blue-600 text-white"
                >
                  <Save className="mr-1.5 h-4 w-4" />
                  {createMutation.isPending ? 'Creating...' : 'Create account'}
                </Button>
                <p className="text-xs text-slate-500">
                  The account is created through the server-side authentication flow.
                </p>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      <Card className="border-slate-200 shadow-sm dark:border-slate-800">
        <CardHeader className="flex flex-col justify-between gap-4 pb-4 sm:flex-row sm:items-center">
          <div className="flex flex-1 items-center gap-2">
            <Input
              type="search"
              placeholder="Search by name or email..."
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              className="h-9 max-w-md text-xs"
            />
            <Button
              type="button"
              variant="ghost"
              size="sm"
              title="Refresh users"
              onClick={() => void usersQuery.refetch()}
            >
              <RefreshCw className="h-4 w-4" />
              <span className="sr-only">Refresh users</span>
            </Button>
          </div>
          <select
            value={selectedRole}
            onChange={(event) => setSelectedRole(event.target.value as 'ALL' | UserRole)}
            className="h-9 rounded-md border border-slate-200 bg-white px-3 text-xs text-slate-700 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300"
          >
            <option value="ALL">All system roles</option>
            {USER_ROLES.map((role) => (
              <option key={role} value={role}>
                {role}
              </option>
            ))}
          </select>
        </CardHeader>
        <CardContent className="p-0">
          {filteredUsers.length === 0 ? (
            <div className="p-6">
              <EmptyState
                title={usersQuery.data.length === 0 ? 'No user accounts yet' : 'No matching users'}
                description={
                  usersQuery.data.length === 0
                    ? 'Create the first portal account to continue.'
                    : 'Try a different search or role filter.'
                }
              />
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>User name</TableHead>
                  <TableHead>Email address</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredUsers.map((user) => (
                  <TableRow key={user.id}>
                    <TableCell className="text-xs font-semibold text-slate-900 dark:text-slate-100">
                      {user.name}
                    </TableCell>
                    <TableCell className="font-mono text-xs text-slate-500">{user.email}</TableCell>
                    <TableCell>
                      <select
                        value={user.role}
                        disabled={updateMutation.isPending}
                        onChange={(event) => updateRole(user, event.target.value as UserRole)}
                        className={`rounded-md border px-2 py-1 text-[10px] font-semibold ${roleClass(user.role)}`}
                        aria-label={`Role for ${user.name}`}
                      >
                        {USER_ROLES.map((role) => (
                          <option key={role} value={role}>
                            {role}
                          </option>
                        ))}
                      </select>
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant="outline"
                        className={
                          user.active
                            ? 'border-emerald-200 bg-emerald-50 text-[10px] text-emerald-700'
                            : 'border-rose-200 bg-rose-50 text-[10px] text-rose-700'
                        }
                      >
                        {user.active ? 'Active' : 'Disabled'}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs text-slate-500">
                      {formatCreatedAt(user.createdAt)}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        disabled={updateMutation.isPending}
                        onClick={() => updateStatus(user)}
                        className={
                          user.active
                            ? 'h-8 text-xs text-rose-600 hover:bg-rose-50 hover:text-rose-700'
                            : 'h-8 text-xs text-emerald-600 hover:bg-emerald-50 hover:text-emerald-700'
                        }
                      >
                        {user.active ? (
                          <>
                            <UserX className="mr-1 h-3.5 w-3.5" /> Disable
                          </>
                        ) : (
                          <>
                            <UserCheck className="mr-1 h-3.5 w-3.5" /> Activate
                          </>
                        )}
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="space-y-1 text-xs font-semibold text-slate-700 dark:text-slate-300">
      <span>{label}</span>
      {children}
    </label>
  );
}
