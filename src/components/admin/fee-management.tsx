'use client';

import { useCallback, useMemo, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useForm } from '@tanstack/react-form';
import { flexRender, getCoreRowModel, useReactTable, type ColumnDef } from '@tanstack/react-table';
import {
  feeCategoryCreateInputSchema,
  feeStructureCreateInputSchema,
  type FeeCategoryCreateInput,
  type FeeStructureCreateInput,
} from '@/lib/students-fees';
import { formatCentavos } from '@/lib/utils/currency';
import { getClientErrorMessage, requestJson } from '@/lib/client-api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
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
import { Archive, Pencil, Plus, RefreshCw, Tag } from 'lucide-react';

type FeeCategory = FeeCategoryCreateInput & { id: string; createdAt: string };
type FeeItem = {
  id: string;
  feeCategoryId: string;
  name: string;
  amountCentavos: number;
  feeCategoryName: string;
  feeCategoryCode: string;
};
type FeeStructure = {
  id: string;
  schoolYearId: string;
  gradeLevelId: string;
  assessmentPeriod: FeeStructureCreateInput['assessmentPeriod'];
  name: string;
  status: FeeStructureCreateInput['status'];
  schoolYearName: string;
  schoolYearStatus: string;
  gradeLevelName: string;
  gradeLevelCode: string;
  items: FeeItem[];
};
type FeeOptions = {
  schoolYears: Array<{ id: string; name: string; status: string }>;
  gradeLevels: Array<{ id: string; name: string; code: string }>;
  feeCategories: FeeCategory[];
};

const emptyCategory: FeeCategoryCreateInput = {
  name: '',
  code: '',
  description: null,
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

function CategoryEditor({ onCancel, onSaved }: { onCancel: () => void; onSaved: () => void }) {
  const [formError, setFormError] = useState<string | null>(null);
  const form = useForm({
    defaultValues: emptyCategory,
    validators: { onSubmit: feeCategoryCreateInputSchema },
    onSubmit: async ({ value }) => {
      setFormError(null);
      try {
        await requestJson<FeeCategory>('/api/admin/fee-categories', {
          method: 'POST',
          body: JSON.stringify(value),
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
      <div className="grid gap-4 sm:grid-cols-2">
        <form.Field name="name">
          {(field) => (
            <label className="text-xs font-semibold">
              Category name
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
        <form.Field name="code">
          {(field) => (
            <label className="text-xs font-semibold">
              Code
              <Input
                className="mt-1 text-sm"
                value={field.state.value}
                onChange={(event) => field.handleChange(event.target.value)}
                onBlur={field.handleBlur}
                placeholder="TUITION"
              />
            </label>
          )}
        </form.Field>
      </div>
      <form.Field name="description">
        {(field) => (
          <label className="text-xs font-semibold">
            Description <span className="font-normal text-slate-500">(optional)</span>
            <Input
              className="mt-1 text-sm"
              value={field.state.value ?? ''}
              onChange={(event) => field.handleChange(event.target.value || null)}
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
          Create category
        </Button>
      </DialogFooter>
    </form>
  );
}

function StructureEditor({
  options,
  onCancel,
  onSaved,
}: {
  options: FeeOptions | undefined;
  onCancel: () => void;
  onSaved: () => void;
}) {
  const [formError, setFormError] = useState<string | null>(null);
  const form = useForm({
    defaultValues: {
      schoolYearId: '',
      gradeLevelId: '',
      assessmentPeriod: 'ANNUAL' as FeeStructureCreateInput['assessmentPeriod'],
      name: '',
      status: 'DRAFT' as FeeStructureCreateInput['status'],
      items: [{ feeCategoryId: '', name: '', amountCentavos: 0 }],
    },
    validators: { onSubmit: feeStructureCreateInputSchema },
    onSubmit: async ({ value }) => {
      setFormError(null);
      try {
        await requestJson<FeeStructure>('/api/admin/fee-structures', {
          method: 'POST',
          body: JSON.stringify(value),
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
      <div className="grid gap-4 sm:grid-cols-2">
        <form.Field name="name">
          {(field) => (
            <label className="text-xs font-semibold">
              Structure name
              <Input
                className="mt-1 text-sm"
                value={field.state.value}
                onChange={(event) => field.handleChange(event.target.value)}
              />
            </label>
          )}
        </form.Field>
        <form.Field name="assessmentPeriod">
          {(field) => (
            <label className="text-xs font-semibold">
              Assessment period
              <select
                className="mt-1 h-9 w-full rounded-md border border-slate-200 bg-white px-3 text-sm dark:border-slate-800 dark:bg-slate-950"
                value={field.state.value}
                onChange={(event) =>
                  field.handleChange(
                    event.target.value as FeeStructureCreateInput['assessmentPeriod']
                  )
                }
              >
                <option value="ANNUAL">Annual</option>
                <option value="SEMESTER">Semester</option>
                <option value="TRIMESTER">Trimester</option>
                <option value="MONTHLY">Monthly</option>
              </select>
            </label>
          )}
        </form.Field>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <form.Field name="schoolYearId">
          {(field) => (
            <label className="text-xs font-semibold">
              School year
              <select
                className="mt-1 h-9 w-full rounded-md border border-slate-200 bg-white px-3 text-sm dark:border-slate-800 dark:bg-slate-950"
                value={field.state.value}
                onChange={(event) => field.handleChange(event.target.value)}
              >
                <option value="">Choose a school year</option>
                {options?.schoolYears.map((year) => (
                  <option key={year.id} value={year.id} disabled={year.status === 'ARCHIVED'}>
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
                value={field.state.value}
                onChange={(event) => field.handleChange(event.target.value)}
              >
                <option value="">Choose a grade level</option>
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
      <form.Field name="status">
        {(field) => (
          <label className="text-xs font-semibold">
            Initial status
            <select
              className="mt-1 h-9 w-full rounded-md border border-slate-200 bg-white px-3 text-sm dark:border-slate-800 dark:bg-slate-950"
              value={field.state.value}
              onChange={(event) =>
                field.handleChange(event.target.value as FeeStructureCreateInput['status'])
              }
            >
              <option value="DRAFT">Draft</option>
              <option value="ACTIVE">Active</option>
            </select>
          </label>
        )}
      </form.Field>
      <form.Field name="items">
        {(field) => (
          <div className="space-y-3 rounded-lg border border-slate-200 p-3 dark:border-slate-800">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold">Fee items</p>
                <p className="text-[11px] text-slate-500">
                  Each category can appear once per structure.
                </p>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() =>
                  field.handleChange([
                    ...field.state.value,
                    { feeCategoryId: '', name: '', amountCentavos: 0 },
                  ])
                }
              >
                <Plus className="mr-1 h-3.5 w-3.5" /> Add item
              </Button>
            </div>
            {field.state.value.map((item, index) => (
              <div key={index} className="grid gap-2 sm:grid-cols-[1.1fr_1fr_0.7fr_auto]">
                <select
                  className="h-9 rounded-md border border-slate-200 bg-white px-3 text-xs dark:border-slate-800 dark:bg-slate-950"
                  value={item.feeCategoryId}
                  onChange={(event) => {
                    const next = [...field.state.value];
                    next[index] = { ...next[index], feeCategoryId: event.target.value };
                    field.handleChange(next);
                  }}
                >
                  <option value="">Category</option>
                  {options?.feeCategories.map((category) => (
                    <option key={category.id} value={category.id}>
                      {category.name}
                    </option>
                  ))}
                </select>
                <Input
                  className="text-xs"
                  placeholder="Item name"
                  value={item.name}
                  onChange={(event) => {
                    const next = [...field.state.value];
                    next[index] = { ...next[index], name: event.target.value };
                    field.handleChange(next);
                  }}
                />
                <Input
                  type="number"
                  min="1"
                  className="text-xs"
                  placeholder="Centavos"
                  value={item.amountCentavos || ''}
                  onChange={(event) => {
                    const next = [...field.state.value];
                    next[index] = {
                      ...next[index],
                      amountCentavos: Number(event.target.value) || 0,
                    };
                    field.handleChange(next);
                  }}
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  disabled={field.state.value.length === 1}
                  onClick={() =>
                    field.handleChange(
                      field.state.value.filter((_, itemIndex) => itemIndex !== index)
                    )
                  }
                >
                  Remove
                </Button>
              </div>
            ))}
            {fieldError(field.state.meta.errors) && (
              <p className="text-xs font-normal text-red-600">
                {fieldError(field.state.meta.errors)}
              </p>
            )}
          </div>
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
          Create structure
        </Button>
      </DialogFooter>
    </form>
  );
}

export function FeeManagement() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const queryString = searchParams.toString();
  const queryClient = useQueryClient();
  const [categoryOpen, setCategoryOpen] = useState(false);
  const [structureOpen, setStructureOpen] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const optionsQuery = useQuery({
    queryKey: ['admin-fee-options'],
    queryFn: () => requestJson<FeeOptions>('/api/admin/fee-options'),
  });
  const structuresQuery = useQuery({
    queryKey: ['admin-fee-structures', queryString],
    queryFn: () =>
      requestJson<FeeStructure[]>(
        `/api/admin/fee-structures${queryString ? `?${queryString}` : ''}`
      ),
  });

  const updateStatusFilter = (value: string) => {
    const next = new URLSearchParams(queryString);
    if (value) next.set('status', value);
    else next.delete('status');
    router.replace(`${pathname}${next.toString() ? `?${next.toString()}` : ''}`);
  };

  const archiveStructure = useCallback(
    async (structure: FeeStructure) => {
      if (
        !window.confirm(
          `Archive ${structure.name}? Archived structures cannot be used for new assessments.`
        )
      ) {
        return;
      }
      setNotice(null);
      try {
        await requestJson(`/api/admin/fee-structures/${structure.id}`, {
          method: 'PATCH',
          body: JSON.stringify({ status: 'ARCHIVED' }),
        });
        await queryClient.invalidateQueries({ queryKey: ['admin-fee-structures'] });
        setNotice('Fee structure archived.');
      } catch (error) {
        setNotice(getClientErrorMessage(error));
      }
    },
    [queryClient]
  );

  const archiveCategory = async (category: FeeCategory) => {
    if (!window.confirm(`Archive fee category ${category.name}?`)) return;
    setNotice(null);
    try {
      await requestJson(`/api/admin/fee-categories/${category.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ status: 'ARCHIVED' }),
      });
      await queryClient.invalidateQueries({ queryKey: ['admin-fee-options'] });
      setNotice('Fee category archived.');
    } catch (error) {
      setNotice(getClientErrorMessage(error));
    }
  };

  const columns = useMemo<ColumnDef<FeeStructure>[]>(
    () => [
      {
        id: 'structure',
        header: 'Fee structure',
        cell: ({ row }) => (
          <div>
            <p className="flex items-center gap-1 font-semibold text-slate-900 dark:text-slate-100">
              <Tag className="h-3.5 w-3.5 text-blue-600" /> {row.original.name}
            </p>
            <p className="text-[11px] text-slate-500">{row.original.items.length} item(s)</p>
          </div>
        ),
      },
      {
        id: 'scope',
        header: 'Scope',
        cell: ({ row }) => (
          <div className="text-xs">
            <p>{row.original.gradeLevelName}</p>
            <p className="text-slate-500">
              {row.original.schoolYearName} · {row.original.assessmentPeriod}
            </p>
          </div>
        ),
      },
      {
        id: 'amount',
        header: 'Total',
        cell: ({ row }) => (
          <span className="text-xs font-semibold">
            {formatCentavos(
              row.original.items.reduce((total, item) => total + item.amountCentavos, 0)
            )}
          </span>
        ),
      },
      {
        accessorKey: 'status',
        header: 'Status',
        cell: ({ row }) => (
          <Badge variant="outline" className="text-[10px]">
            {row.original.status}
          </Badge>
        ),
      },
      {
        id: 'actions',
        header: 'Actions',
        cell: ({ row }) => (
          <Button
            variant="ghost"
            size="sm"
            className="text-amber-700"
            disabled={row.original.status === 'ARCHIVED'}
            onClick={() => void archiveStructure(row.original)}
          >
            <Archive className="mr-1 h-3.5 w-3.5" /> Archive
          </Button>
        ),
      },
    ],
    [archiveStructure]
  );
  const table = useReactTable({
    data: structuresQuery.data ?? [],
    columns,
    getCoreRowModel: getCoreRowModel(),
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <Badge variant="outline" className="border-blue-200 bg-blue-50 text-blue-700">
            Fee structures
          </Badge>
          <h2 className="mt-1 text-2xl font-bold tracking-tight">Fees Management</h2>
          <p className="text-xs text-slate-500">
            Manage categories and year/grade fee structures persisted in PostgreSQL.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" className="text-xs" onClick={() => setCategoryOpen(true)}>
            <Plus className="mr-1.5 h-4 w-4" /> Category
          </Button>
          <Button
            className="bg-blue-600 text-xs text-white hover:bg-blue-700"
            onClick={() => setStructureOpen(true)}
          >
            <Plus className="mr-1.5 h-4 w-4" /> Structure
          </Button>
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[0.75fr_1.25fr]">
        <Card className="border-slate-200 shadow-sm dark:border-slate-800">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base">Fee categories</CardTitle>
            <span className="text-xs text-slate-500">
              {optionsQuery.data?.feeCategories.length ?? 0} active
            </span>
          </CardHeader>
          <CardContent className="space-y-2">
            {optionsQuery.isLoading && (
              <p className="text-sm text-slate-500">Loading categories…</p>
            )}
            {optionsQuery.isError && (
              <p className="text-sm text-red-600">{getClientErrorMessage(optionsQuery.error)}</p>
            )}
            {optionsQuery.data?.feeCategories.map((category) => (
              <div
                key={category.id}
                className="flex items-center justify-between rounded-md border border-slate-100 px-3 py-2 dark:border-slate-800"
              >
                <div>
                  <p className="text-xs font-semibold">{category.name}</p>
                  <p className="font-mono text-[10px] text-slate-500">{category.code}</p>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-amber-700"
                  onClick={() => void archiveCategory(category)}
                >
                  <Archive className="mr-1 h-3.5 w-3.5" /> Archive
                </Button>
              </div>
            ))}
            {optionsQuery.data?.feeCategories.length === 0 && (
              <p className="text-sm text-slate-500">No active categories yet.</p>
            )}
          </CardContent>
        </Card>

        <Card className="border-slate-200 shadow-sm dark:border-slate-800">
          <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <CardTitle className="text-base">Fee structures</CardTitle>
            <select
              className="h-9 rounded-md border border-slate-200 bg-white px-3 text-xs dark:border-slate-800 dark:bg-slate-950"
              value={searchParams.get('status') ?? ''}
              onChange={(event) => updateStatusFilter(event.target.value)}
            >
              <option value="">All statuses</option>
              <option value="DRAFT">Draft</option>
              <option value="ACTIVE">Active</option>
              <option value="ARCHIVED">Archived</option>
            </select>
          </CardHeader>
          <CardContent className="p-0">
            {notice && (
              <p className="border-b border-slate-100 px-4 py-3 text-xs text-blue-700">{notice}</p>
            )}
            {structuresQuery.isLoading && (
              <p className="p-6 text-sm text-slate-500">Loading fee structures…</p>
            )}
            {structuresQuery.isError && (
              <div className="flex items-center justify-between p-6 text-sm text-red-600">
                <span>{getClientErrorMessage(structuresQuery.error)}</span>
                <Button variant="outline" size="sm" onClick={() => void structuresQuery.refetch()}>
                  <RefreshCw className="mr-1 h-3.5 w-3.5" /> Retry
                </Button>
              </div>
            )}
            {!structuresQuery.isLoading && !structuresQuery.isError && (
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
                        No fee structures match the current filter.
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
      </div>

      <Dialog open={categoryOpen} onOpenChange={setCategoryOpen}>
        <DialogHeader>
          <DialogTitle>Create fee category</DialogTitle>
          <DialogDescription>
            Categories can be archived, preserving their historical references.
          </DialogDescription>
        </DialogHeader>
        <CategoryEditor
          onCancel={() => setCategoryOpen(false)}
          onSaved={() => {
            setCategoryOpen(false);
            void queryClient.invalidateQueries({ queryKey: ['admin-fee-options'] });
          }}
        />
      </Dialog>

      <Dialog open={structureOpen} onOpenChange={setStructureOpen}>
        <DialogHeader>
          <DialogTitle>Create fee structure</DialogTitle>
          <DialogDescription>
            Active structures require an active school year and active categories.
          </DialogDescription>
        </DialogHeader>
        <StructureEditor
          options={optionsQuery.data}
          onCancel={() => setStructureOpen(false)}
          onSaved={() => {
            setStructureOpen(false);
            void queryClient.invalidateQueries({ queryKey: ['admin-fee-structures'] });
          }}
        />
      </Dialog>
    </div>
  );
}
