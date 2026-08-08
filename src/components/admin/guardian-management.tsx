'use client';

import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useForm } from '@tanstack/react-form';
import { flexRender, getCoreRowModel, useReactTable, type ColumnDef } from '@tanstack/react-table';
import {
  guardianCreateInputSchema,
  guardianStudentLinkInputSchema,
  type GuardianCreateInput,
  type GuardianStudentLinkInput,
} from '@/lib/students-fees';
import { getClientErrorMessage, requestJson } from '@/lib/client-api';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Link2, Pencil, Plus, RefreshCw, Search } from 'lucide-react';

type GuardianRow = GuardianCreateInput & {
  id: string;
  createdAt: string;
  updatedAt: string;
  linkedStudentCount: number;
};

type StudentOption = {
  id: string;
  studentNumber: string;
  firstName: string;
  lastName: string;
  status: string;
};

type StudentListResponse = { data: StudentOption[] };

const emptyGuardian: GuardianCreateInput = {
  firstName: '',
  lastName: '',
  email: '',
  phone: '',
  relationship: 'Parent',
  address: '',
  userId: null,
};

function fieldError(errors: unknown[]): string | null {
  const error = errors[0];
  if (!error) return null;
  if (typeof error === 'string') return error;
  if (typeof error === 'object' && error !== null && 'message' in error) {
    return String(error.message);
  }
  return String(error);
}

function GuardianEditor({
  initial,
  guardianId,
  onCancel,
  onSaved,
}: {
  initial: GuardianCreateInput;
  guardianId: string | null;
  onCancel: () => void;
  onSaved: () => void;
}) {
  const [formError, setFormError] = useState<string | null>(null);
  const form = useForm({
    defaultValues: initial,
    validators: { onSubmit: guardianCreateInputSchema },
    onSubmit: async ({ value }) => {
      setFormError(null);
      try {
        await requestJson<GuardianRow>(
          guardianId ? `/api/admin/guardians/${guardianId}` : '/api/admin/guardians',
          {
            method: guardianId ? 'PATCH' : 'POST',
            body: JSON.stringify(value),
          }
        );
        onSaved();
      } catch (error) {
        setFormError(getClientErrorMessage(error));
      }
    },
  });

  return (
    <form
      className="space-y-4"
      onSubmit={(event) => {
        event.preventDefault();
        void form.handleSubmit();
      }}
      noValidate
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <form.Field name="firstName">
          {(field) => (
            <label className="text-xs font-semibold">
              First name
              <Input
                className="mt-1 text-sm"
                value={field.state.value}
                onChange={(event) => field.handleChange(event.target.value)}
                onBlur={field.handleBlur}
              />
              {fieldError(field.state.meta.errors) && (
                <span className="mt-1 block font-normal text-red-600">
                  {fieldError(field.state.meta.errors)}
                </span>
              )}
            </label>
          )}
        </form.Field>
        <form.Field name="lastName">
          {(field) => (
            <label className="text-xs font-semibold">
              Last name
              <Input
                className="mt-1 text-sm"
                value={field.state.value}
                onChange={(event) => field.handleChange(event.target.value)}
                onBlur={field.handleBlur}
              />
            </label>
          )}
        </form.Field>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <form.Field name="email">
          {(field) => (
            <label className="text-xs font-semibold">
              Email
              <Input
                type="email"
                className="mt-1 text-sm"
                value={field.state.value}
                onChange={(event) => field.handleChange(event.target.value)}
                onBlur={field.handleBlur}
              />
            </label>
          )}
        </form.Field>
        <form.Field name="phone">
          {(field) => (
            <label className="text-xs font-semibold">
              Phone
              <Input
                className="mt-1 text-sm"
                value={field.state.value}
                onChange={(event) => field.handleChange(event.target.value)}
                onBlur={field.handleBlur}
              />
            </label>
          )}
        </form.Field>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <form.Field name="relationship">
          {(field) => (
            <label className="text-xs font-semibold">
              Relationship
              <Input
                className="mt-1 text-sm"
                value={field.state.value}
                onChange={(event) => field.handleChange(event.target.value)}
              />
            </label>
          )}
        </form.Field>
        <form.Field name="userId">
          {(field) => (
            <label className="text-xs font-semibold">
              Parent account ID <span className="font-normal text-slate-500">(optional)</span>
              <Input
                className="mt-1 text-sm"
                value={field.state.value ?? ''}
                onChange={(event) => field.handleChange(event.target.value || null)}
                placeholder="Better Auth user ID"
              />
            </label>
          )}
        </form.Field>
      </div>
      <form.Field name="address">
        {(field) => (
          <label className="text-xs font-semibold">
            Address
            <Input
              className="mt-1 text-sm"
              value={field.state.value}
              onChange={(event) => field.handleChange(event.target.value)}
            />
          </label>
        )}
      </form.Field>
      {formError && (
        <p className="rounded-md bg-red-50 px-3 py-2 text-xs text-red-700">{formError}</p>
      )}
      <DialogFooter>
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" className="bg-blue-600 text-white hover:bg-blue-700">
          {guardianId ? 'Save changes' : 'Create guardian'}
        </Button>
      </DialogFooter>
    </form>
  );
}

function GuardianLinkEditor({
  guardianId,
  students,
  onCancel,
  onSaved,
}: {
  guardianId: string;
  students: StudentOption[];
  onCancel: () => void;
  onSaved: () => void;
}) {
  const [formError, setFormError] = useState<string | null>(null);
  const form = useForm({
    defaultValues: { guardianId, studentId: '', isPrimary: false } as GuardianStudentLinkInput,
    validators: {
      onSubmit: ({ value }) => {
        const result = guardianStudentLinkInputSchema.safeParse(value);
        return result.success ? undefined : result.error;
      },
    },
    onSubmit: async ({ value }) => {
      setFormError(null);
      try {
        await requestJson(`/api/admin/students/${value.studentId}/guardians`, {
          method: 'POST',
          body: JSON.stringify({ guardianId: value.guardianId, isPrimary: value.isPrimary }),
        });
        onSaved();
      } catch (error) {
        setFormError(getClientErrorMessage(error));
      }
    },
  });

  return (
    <form
      className="space-y-4"
      onSubmit={(event) => {
        event.preventDefault();
        void form.handleSubmit();
      }}
      noValidate
    >
      <form.Field name="studentId">
        {(field) => (
          <label className="text-xs font-semibold">
            Student
            <select
              className="mt-1 h-9 w-full rounded-md border border-slate-200 bg-white px-3 text-sm dark:border-slate-800 dark:bg-slate-950"
              value={field.state.value}
              onChange={(event) => field.handleChange(event.target.value)}
            >
              <option value="">Choose a student</option>
              {students.map((student) => (
                <option key={student.id} value={student.id}>
                  {student.studentNumber} · {student.firstName} {student.lastName} ({student.status}
                  )
                </option>
              ))}
            </select>
          </label>
        )}
      </form.Field>
      <form.Field name="isPrimary">
        {(field) => (
          <label className="flex items-center gap-2 text-xs font-semibold">
            <input
              type="checkbox"
              checked={field.state.value}
              onChange={(event) => field.handleChange(event.target.checked)}
            />
            Make this the primary guardian for the student
          </label>
        )}
      </form.Field>
      {formError && (
        <p className="rounded-md bg-red-50 px-3 py-2 text-xs text-red-700">{formError}</p>
      )}
      <DialogFooter>
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" className="bg-blue-600 text-white hover:bg-blue-700">
          Link student
        </Button>
      </DialogFooter>
    </form>
  );
}

export function GuardianManagement() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const queryString = searchParams.toString();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState(searchParams.get('search') ?? '');
  const [editor, setEditor] = useState<{ id: string | null; value: GuardianCreateInput } | null>(
    null
  );
  const [linkGuardianId, setLinkGuardianId] = useState<string | null>(null);
  const [key, setKey] = useState(0);

  const guardiansQuery = useQuery({
    queryKey: ['admin-guardians', queryString],
    queryFn: () =>
      requestJson<GuardianRow[]>(`/api/admin/guardians${queryString ? `?${queryString}` : ''}`),
  });
  const studentsQuery = useQuery({
    queryKey: ['admin-student-options'],
    queryFn: () => requestJson<StudentListResponse>('/api/admin/students?pageSize=100'),
  });

  const updateSearch = (value: string) => {
    setSearch(value);
    const next = new URLSearchParams(queryString);
    if (value) next.set('search', value);
    else next.delete('search');
    router.replace(`${pathname}${next.toString() ? `?${next.toString()}` : ''}`);
  };

  const columns = useMemo<ColumnDef<GuardianRow>[]>(
    () => [
      {
        id: 'name',
        header: 'Guardian',
        cell: ({ row }) => (
          <div>
            <p className="font-semibold text-slate-900 dark:text-slate-100">
              {row.original.firstName} {row.original.lastName}
            </p>
            <p className="text-[11px] text-slate-500">
              {row.original.email} · {row.original.phone}
            </p>
          </div>
        ),
      },
      { accessorKey: 'relationship', header: 'Relationship' },
      {
        accessorKey: 'linkedStudentCount',
        header: 'Linked students',
        cell: ({ row }) => <span className="text-xs">{row.original.linkedStudentCount}</span>,
      },
      {
        id: 'account',
        header: 'Account',
        cell: ({ row }) => (
          <Badge variant="outline" className="text-[10px]">
            {row.original.userId ? 'Parent linked' : 'No account'}
          </Badge>
        ),
      },
      {
        id: 'actions',
        header: 'Actions',
        cell: ({ row }) => (
          <div className="flex justify-end gap-1">
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-blue-600"
              onClick={() => setLinkGuardianId(row.original.id)}
            >
              <Link2 className="h-4 w-4" />
              <span className="sr-only">Link a student</span>
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-slate-600"
              onClick={() => {
                setEditor({ id: row.original.id, value: row.original });
                setKey((value) => value + 1);
              }}
            >
              <Pencil className="h-4 w-4" />
              <span className="sr-only">Edit guardian</span>
            </Button>
          </div>
        ),
      },
    ],
    []
  );

  const table = useReactTable({
    data: guardiansQuery.data ?? [],
    columns,
    getCoreRowModel: getCoreRowModel(),
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <Badge variant="outline" className="border-blue-200 bg-blue-50 text-blue-700">
            ADMIN · GUARDIANS
          </Badge>
          <h2 className="mt-1 text-2xl font-bold tracking-tight">Guardian Directory</h2>
          <p className="text-xs text-slate-500">
            Maintain parent links and the students they can represent.
          </p>
        </div>
        <Button
          className="bg-blue-600 text-xs text-white hover:bg-blue-700"
          onClick={() => {
            setEditor({ id: null, value: emptyGuardian });
            setKey((value) => value + 1);
          }}
        >
          <Plus className="mr-1.5 h-4 w-4" /> Add guardian
        </Button>
      </div>

      <Card className="border-slate-200 shadow-sm dark:border-slate-800">
        <CardHeader className="flex flex-row items-center gap-3 pb-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
            <Input
              className="pl-9 text-xs"
              placeholder="Search by name, email, or phone"
              value={search}
              onChange={(event) => updateSearch(event.target.value)}
            />
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {guardiansQuery.isLoading && (
            <p className="p-6 text-sm text-slate-500">Loading guardians…</p>
          )}
          {guardiansQuery.isError && (
            <div className="flex items-center justify-between p-6 text-sm text-red-600">
              <span>{getClientErrorMessage(guardiansQuery.error)}</span>
              <Button variant="outline" size="sm" onClick={() => void guardiansQuery.refetch()}>
                <RefreshCw className="mr-1 h-3.5 w-3.5" /> Retry
              </Button>
            </div>
          )}
          {!guardiansQuery.isLoading && !guardiansQuery.isError && (
            <Table>
              <TableHeader>
                {table.getHeaderGroups().map((group) => (
                  <TableRow key={group.id}>
                    {group.headers.map((header) => (
                      <TableHead
                        key={header.id}
                        className={header.id === 'actions' ? 'text-right' : undefined}
                      >
                        {flexRender(header.column.columnDef.header, header.getContext())}
                      </TableHead>
                    ))}
                  </TableRow>
                ))}
              </TableHeader>
              <TableBody>
                {table.getRowModel().rows.length === 0 && (
                  <TableRow>
                    <TableCell
                      colSpan={columns.length}
                      className="py-10 text-center text-sm text-slate-500"
                    >
                      No guardians match the current search.
                    </TableCell>
                  </TableRow>
                )}
                {table.getRowModel().rows.map((row) => (
                  <TableRow key={row.id}>
                    {row.getVisibleCells().map((cell) => (
                      <TableCell
                        key={cell.id}
                        className={cell.column.id === 'actions' ? 'text-right' : undefined}
                      >
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </TableCell>
                    ))}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={Boolean(editor)} onOpenChange={(open) => !open && setEditor(null)}>
        <DialogHeader>
          <DialogTitle>{editor?.id ? 'Edit guardian record' : 'Add guardian record'}</DialogTitle>
          <DialogDescription>
            Parent accounts must have the PARENT role before they can be linked.
          </DialogDescription>
        </DialogHeader>
        {editor && (
          <GuardianEditor
            key={key}
            initial={editor.value}
            guardianId={editor.id}
            onCancel={() => setEditor(null)}
            onSaved={() => {
              setEditor(null);
              void queryClient.invalidateQueries({ queryKey: ['admin-guardians'] });
            }}
          />
        )}
      </Dialog>

      <Dialog
        open={Boolean(linkGuardianId)}
        onOpenChange={(open) => !open && setLinkGuardianId(null)}
      >
        <DialogHeader>
          <DialogTitle>Link guardian to a student</DialogTitle>
          <DialogDescription>
            Duplicate links are rejected; choosing primary makes other links non-primary.
          </DialogDescription>
        </DialogHeader>
        {linkGuardianId && (
          <GuardianLinkEditor
            guardianId={linkGuardianId}
            students={studentsQuery.data?.data ?? []}
            onCancel={() => setLinkGuardianId(null)}
            onSaved={() => {
              setLinkGuardianId(null);
              void queryClient.invalidateQueries({ queryKey: ['admin-guardians'] });
            }}
          />
        )}
      </Dialog>
    </div>
  );
}
