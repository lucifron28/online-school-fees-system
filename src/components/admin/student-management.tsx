'use client';

import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useCallback, useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useForm } from '@tanstack/react-form';
import { flexRender, getCoreRowModel, useReactTable, type ColumnDef } from '@tanstack/react-table';
import { studentCreateInputSchema, type StudentCreateInput } from '@/lib/students-fees';
import { requestJson, getClientErrorMessage } from '@/lib/client-api';
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
import { Eye, Pencil, Plus, RefreshCw, Search, UserX } from 'lucide-react';

type StudentRow = StudentCreateInput & {
  id: string;
  createdAt: string;
  updatedAt: string;
  gradeLevelName: string | null;
  gradeLevelCode: string | null;
  sectionName: string | null;
  sectionCode: string | null;
  schoolYearName: string | null;
};

type StudentListResponse = {
  data: StudentRow[];
  pagination: { page: number; pageSize: number; total: number; totalPages: number };
};

type FeeOptionsResponse = {
  schoolYears: Array<{ id: string; name: string; status: string }>;
  gradeLevels: Array<{ id: string; name: string; code: string }>;
};

type SectionOption = {
  id: string;
  gradeLevelId: string;
  schoolYearId: string;
  name: string;
  code: string;
};

const emptyStudent: StudentCreateInput = {
  studentNumber: '',
  firstName: '',
  lastName: '',
  email: '',
  userId: null,
  gradeLevelId: null,
  sectionId: null,
  schoolYearId: null,
  status: 'ACTIVE',
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

function statusClass(status: StudentRow['status']) {
  return status === 'ACTIVE'
    ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
    : status === 'INACTIVE'
      ? 'border-slate-200 bg-slate-100 text-slate-600'
      : 'border-amber-200 bg-amber-50 text-amber-700';
}

function StudentEditor({
  initial,
  studentId,
  options,
  sections,
  onSaved,
  onCancel,
}: {
  initial: StudentCreateInput;
  studentId: string | null;
  options: FeeOptionsResponse | undefined;
  sections: SectionOption[];
  onSaved: () => void;
  onCancel: () => void;
}) {
  const [formError, setFormError] = useState<string | null>(null);
  const form = useForm({
    defaultValues: initial,
    validators: { onSubmit: studentCreateInputSchema },
    onSubmit: async ({ value }) => {
      setFormError(null);
      try {
        await requestJson<StudentRow>(
          studentId ? `/api/admin/students/${studentId}` : '/api/admin/students',
          {
            method: studentId ? 'PATCH' : 'POST',
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
      onSubmit={(event) => {
        event.preventDefault();
        void form.handleSubmit();
      }}
      className="space-y-4"
      noValidate
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <form.Field name="studentNumber">
          {(field) => {
            const error = fieldError(field.state.meta.errors);
            return (
              <label className="text-xs font-semibold">
                Student number
                <Input
                  className="mt-1 text-sm"
                  value={field.state.value}
                  onChange={(event) => field.handleChange(event.target.value)}
                  onBlur={field.handleBlur}
                  aria-invalid={Boolean(error)}
                  placeholder="2026-0001"
                />
                {error && <span className="mt-1 block font-normal text-red-600">{error}</span>}
              </label>
            );
          }}
        </form.Field>
        <form.Field name="status">
          {(field) => (
            <label className="text-xs font-semibold">
              Status
              <select
                className="mt-1 h-9 w-full rounded-md border border-slate-200 bg-white px-3 text-sm dark:border-slate-800 dark:bg-slate-950"
                value={field.state.value}
                onChange={(event) => field.handleChange(event.target.value as StudentRow['status'])}
              >
                <option value="ACTIVE">Active</option>
                <option value="INACTIVE">Inactive</option>
                <option value="WITHDRAWN">Withdrawn</option>
                <option value="GRADUATED">Graduated</option>
              </select>
            </label>
          )}
        </form.Field>
      </div>

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

      <form.Field name="email">
        {(field) => (
          <label className="text-xs font-semibold">
            Student email
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

      <div className="grid gap-4 sm:grid-cols-2">
        <form.Field name="schoolYearId">
          {(field) => (
            <label className="text-xs font-semibold">
              School year
              <select
                className="mt-1 h-9 w-full rounded-md border border-slate-200 bg-white px-3 text-sm dark:border-slate-800 dark:bg-slate-950"
                value={field.state.value ?? ''}
                onChange={(event) => field.handleChange(event.target.value || null)}
              >
                <option value="">Unassigned</option>
                {options?.schoolYears.map((year) => (
                  <option key={year.id} value={year.id}>
                    {year.name} ({year.status})
                  </option>
                ))}
              </select>
            </label>
          )}
        </form.Field>
        <form.Field name="gradeLevelId">
          {(field) => (
            <label className="text-xs font-semibold">
              Grade level
              <select
                className="mt-1 h-9 w-full rounded-md border border-slate-200 bg-white px-3 text-sm dark:border-slate-800 dark:bg-slate-950"
                value={field.state.value ?? ''}
                onChange={(event) => field.handleChange(event.target.value || null)}
              >
                <option value="">Unassigned</option>
                {options?.gradeLevels.map((grade) => (
                  <option key={grade.id} value={grade.id}>
                    {grade.name}
                  </option>
                ))}
              </select>
            </label>
          )}
        </form.Field>
      </div>

      <form.Field name="sectionId">
        {(field) => (
          <label className="text-xs font-semibold">
            Section
            <select
              className="mt-1 h-9 w-full rounded-md border border-slate-200 bg-white px-3 text-sm dark:border-slate-800 dark:bg-slate-950"
              value={field.state.value ?? ''}
              onChange={(event) => field.handleChange(event.target.value || null)}
            >
              <option value="">Unassigned</option>
              {sections.map((section) => (
                <option key={section.id} value={section.id}>
                  {section.name} ({section.code})
                </option>
              ))}
            </select>
            <span className="mt-1 block font-normal text-slate-500">
              A section must match the selected grade level and school year.
            </span>
          </label>
        )}
      </form.Field>

      <form.Field name="userId">
        {(field) => (
          <label className="text-xs font-semibold">
            Student account ID <span className="font-normal text-slate-500">(optional)</span>
            <Input
              className="mt-1 text-sm"
              value={field.state.value ?? ''}
              onChange={(event) => field.handleChange(event.target.value || null)}
              placeholder="Better Auth user ID"
            />
          </label>
        )}
      </form.Field>

      {formError && (
        <p role="alert" className="rounded-md bg-red-50 px-3 py-2 text-xs text-red-700">
          {formError}
        </p>
      )}
      <DialogFooter>
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" className="bg-blue-600 text-white hover:bg-blue-700">
          {studentId ? 'Save changes' : 'Create student'}
        </Button>
      </DialogFooter>
    </form>
  );
}

export function StudentManagement() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const queryString = searchParams.toString();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState(searchParams.get('search') ?? '');
  const [editor, setEditor] = useState<{ id: string | null; value: StudentCreateInput } | null>(
    null
  );
  const [editorKey, setEditorKey] = useState(0);
  const [notice, setNotice] = useState<string | null>(null);

  const studentsQuery = useQuery({
    queryKey: ['admin-students', queryString],
    queryFn: () =>
      requestJson<StudentListResponse>(
        `/api/admin/students${queryString ? `?${queryString}` : ''}`
      ),
  });
  const optionsQuery = useQuery({
    queryKey: ['admin-fee-options'],
    queryFn: () => requestJson<FeeOptionsResponse>('/api/admin/fee-options'),
  });
  const sectionsQuery = useQuery({
    queryKey: ['admin-sections'],
    queryFn: () => requestJson<SectionOption[]>('/api/admin/sections'),
  });

  const updateQuery = (key: string, value: string) => {
    const next = new URLSearchParams(queryString);
    if (value) next.set(key, value);
    else next.delete(key);
    if (key !== 'page' && key !== 'pageSize') next.delete('page');
    router.replace(`${pathname}${next.toString() ? `?${next.toString()}` : ''}`);
  };

  const changeStatus = useCallback(
    async (student: StudentRow) => {
      const nextStatus = student.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE';
      const action = nextStatus === 'ACTIVE' ? 'activate' : 'deactivate';
      if (
        !window.confirm(
          `Are you sure you want to ${action} ${student.firstName} ${student.lastName}?`
        )
      ) {
        return;
      }
      setNotice(null);
      try {
        await requestJson(`/api/admin/students/${student.id}`, {
          method: 'PATCH',
          body: JSON.stringify({ status: nextStatus }),
        });
        await queryClient.invalidateQueries({ queryKey: ['admin-students'] });
        setNotice(`Student ${action}d successfully.`);
      } catch (error) {
        setNotice(getClientErrorMessage(error));
      }
    },
    [queryClient]
  );

  const columns = useMemo<ColumnDef<StudentRow>[]>(
    () => [
      { accessorKey: 'studentNumber', header: 'Student number' },
      {
        id: 'name',
        header: 'Student',
        cell: ({ row }) => (
          <div>
            <p className="font-semibold text-slate-900 dark:text-slate-100">
              {row.original.firstName} {row.original.lastName}
            </p>
            <p className="text-[11px] text-slate-500">{row.original.email}</p>
          </div>
        ),
      },
      {
        id: 'assignment',
        header: 'Assignment',
        cell: ({ row }) => (
          <div className="text-xs">
            <p>{row.original.gradeLevelName ?? 'No grade level'}</p>
            <p className="text-slate-500">
              {row.original.sectionName ?? 'No section'} ·{' '}
              {row.original.schoolYearName ?? 'No year'}
            </p>
          </div>
        ),
      },
      {
        accessorKey: 'status',
        header: 'Status',
        cell: ({ row }) => (
          <Badge variant="outline" className={`text-[10px] ${statusClass(row.original.status)}`}>
            {row.original.status}
          </Badge>
        ),
      },
      {
        id: 'actions',
        header: 'Actions',
        cell: ({ row }) => (
          <div className="flex justify-end gap-1">
            <Link href={`/admin/students/${row.original.id}`}>
              <Button variant="ghost" size="icon" className="h-8 w-8 text-blue-600">
                <Eye className="h-4 w-4" />
                <span className="sr-only">View student</span>
              </Button>
            </Link>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-slate-600"
              onClick={() => {
                setEditor({ id: row.original.id, value: row.original });
                setEditorKey((value) => value + 1);
              }}
            >
              <Pencil className="h-4 w-4" />
              <span className="sr-only">Edit student</span>
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-amber-600"
              onClick={() => void changeStatus(row.original)}
            >
              <UserX className="h-4 w-4" />
              <span className="sr-only">Change student status</span>
            </Button>
          </div>
        ),
      },
    ],
    [changeStatus]
  );

  const table = useReactTable({
    data: studentsQuery.data?.data ?? [],
    columns,
    getCoreRowModel: getCoreRowModel(),
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <Badge variant="outline" className="border-blue-200 bg-blue-50 text-blue-700">
            Screen #3 · ADMIN - STUDENT LIST
          </Badge>
          <h2 className="mt-1 text-2xl font-bold tracking-tight">Student Directory</h2>
          <p className="text-xs text-slate-500">
            PostgreSQL-backed records with guarded account links.
          </p>
        </div>
        <Button
          className="bg-blue-600 text-xs text-white hover:bg-blue-700"
          onClick={() => {
            setEditor({ id: null, value: emptyStudent });
            setEditorKey((value) => value + 1);
          }}
        >
          <Plus className="mr-1.5 h-4 w-4" /> Add student
        </Button>
      </div>

      <Card className="border-slate-200 shadow-sm dark:border-slate-800">
        <CardHeader className="flex flex-col gap-3 pb-4 sm:flex-row sm:items-center">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
            <Input
              className="pl-9 text-xs"
              placeholder="Search by number, name, or email"
              value={search}
              onChange={(event) => {
                setSearch(event.target.value);
                updateQuery('search', event.target.value);
              }}
            />
          </div>
          <select
            className="h-9 rounded-md border border-slate-200 bg-white px-3 text-xs dark:border-slate-800 dark:bg-slate-950"
            value={searchParams.get('status') ?? ''}
            onChange={(event) => updateQuery('status', event.target.value)}
          >
            <option value="">All statuses</option>
            <option value="ACTIVE">Active</option>
            <option value="INACTIVE">Inactive</option>
            <option value="WITHDRAWN">Withdrawn</option>
            <option value="GRADUATED">Graduated</option>
          </select>
          <select
            className="h-9 rounded-md border border-slate-200 bg-white px-3 text-xs dark:border-slate-800 dark:bg-slate-950"
            value={searchParams.get('sort') ?? 'lastName'}
            onChange={(event) => updateQuery('sort', event.target.value)}
            aria-label="Sort students by"
          >
            <option value="lastName">Sort: last name</option>
            <option value="firstName">Sort: first name</option>
            <option value="studentNumber">Sort: student number</option>
            <option value="status">Sort: status</option>
          </select>
          <select
            className="h-9 rounded-md border border-slate-200 bg-white px-3 text-xs dark:border-slate-800 dark:bg-slate-950"
            value={searchParams.get('direction') ?? 'asc'}
            onChange={(event) => updateQuery('direction', event.target.value)}
            aria-label="Sort direction"
          >
            <option value="asc">Ascending</option>
            <option value="desc">Descending</option>
          </select>
        </CardHeader>
        <CardContent className="p-0">
          {notice && (
            <p className="border-b border-slate-100 px-4 py-3 text-xs text-blue-700">{notice}</p>
          )}
          {studentsQuery.isLoading && (
            <p className="p-6 text-sm text-slate-500">Loading students…</p>
          )}
          {studentsQuery.isError && (
            <div className="flex items-center justify-between p-6 text-sm text-red-600">
              <span>{getClientErrorMessage(studentsQuery.error)}</span>
              <Button variant="outline" size="sm" onClick={() => void studentsQuery.refetch()}>
                <RefreshCw className="mr-1 h-3.5 w-3.5" /> Retry
              </Button>
            </div>
          )}
          {!studentsQuery.isLoading && !studentsQuery.isError && (
            <Table>
              <TableHeader>
                {table.getHeaderGroups().map((headerGroup) => (
                  <TableRow key={headerGroup.id}>
                    {headerGroup.headers.map((header) => (
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
                      No students match the current filters.
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
          {studentsQuery.data && (
            <div className="flex items-center justify-between border-t border-slate-100 px-4 py-3 text-xs text-slate-500">
              <span>
                {studentsQuery.data.pagination.total === 0
                  ? 'No records'
                  : `Page ${studentsQuery.data.pagination.page} of ${studentsQuery.data.pagination.totalPages} · ${studentsQuery.data.pagination.total} students`}
              </span>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={studentsQuery.data.pagination.page <= 1}
                  onClick={() =>
                    updateQuery('page', String(studentsQuery.data!.pagination.page - 1))
                  }
                >
                  Previous
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={
                    studentsQuery.data.pagination.page >= studentsQuery.data.pagination.totalPages
                  }
                  onClick={() =>
                    updateQuery('page', String(studentsQuery.data!.pagination.page + 1))
                  }
                >
                  Next
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={Boolean(editor)} onOpenChange={(open) => !open && setEditor(null)}>
        <DialogHeader>
          <DialogTitle>{editor?.id ? 'Edit student record' : 'Add student record'}</DialogTitle>
          <DialogDescription>
            Validated through the shared student schema before persistence.
          </DialogDescription>
        </DialogHeader>
        {editor && (
          <StudentEditor
            key={editorKey}
            initial={editor.value}
            studentId={editor.id}
            options={optionsQuery.data}
            sections={sectionsQuery.data ?? []}
            onCancel={() => setEditor(null)}
            onSaved={() => {
              setEditor(null);
              setNotice('Student record saved.');
              void queryClient.invalidateQueries({ queryKey: ['admin-students'] });
            }}
          />
        )}
      </Dialog>
    </div>
  );
}
