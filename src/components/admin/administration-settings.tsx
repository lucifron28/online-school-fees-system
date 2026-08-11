'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Building2, CheckCircle2, Edit, Plus, RefreshCw, Save, Shield } from 'lucide-react';
import { useEffect, useState, type ReactNode } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { EmptyState } from '@/components/ui/empty-state';
import { LoadingState } from '@/components/ui/loading-state';

type SchoolYear = {
  id: string;
  name: string;
  startDate: string;
  endDate: string;
  status: 'DRAFT' | 'ACTIVE' | 'ARCHIVED';
};

type GradeLevel = {
  id: string;
  name: string;
  code: string;
  displayOrder: number;
};

type Section = {
  id: string;
  gradeLevelId: string;
  schoolYearId: string;
  name: string;
  code: string;
};

type Settings = {
  id: string;
  schoolName: string;
  shortName: string;
  address: string;
  email: string;
  phone: string;
  receiptPrefix: string;
  currencyCode: 'PHP';
  timezone: 'Asia/Manila';
  defaultPaymentTermDays: number;
  reminderLeadDays: number;
  gcashEnabled: boolean;
  gcashAccountName: string | null;
  gcashAccountNumber: string | null;
  mayaEnabled: boolean;
  mayaAccountName: string | null;
  mayaAccountNumber: string | null;
  studentPortalEnabled: boolean;
  activeSchoolYearId: string | null;
  updatedAt: string;
};

type AdministrationSnapshot = {
  settings: Settings;
  schoolYears: SchoolYear[];
  gradeLevels: GradeLevel[];
  sections: Section[];
};

async function requestJson<T>(input: RequestInfo, init?: RequestInit): Promise<T> {
  const response = await fetch(input, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...init?.headers,
    },
  });
  const body = (await response.json().catch(() => null)) as { error?: string } | T | null;
  if (!response.ok) {
    throw new Error(
      typeof body === 'object' && body && 'error' in body && body.error
        ? body.error
        : 'The administration request failed.'
    );
  }
  return body as T;
}

function dateOnly(value: string) {
  return value.slice(0, 10);
}

function statusClass(status: SchoolYear['status']) {
  if (status === 'ACTIVE') return 'border-emerald-200 bg-emerald-50 text-emerald-700';
  if (status === 'ARCHIVED') return 'border-slate-200 bg-slate-100 text-slate-600';
  return 'border-amber-200 bg-amber-50 text-amber-700';
}

export function AdministrationSettings() {
  const queryClient = useQueryClient();
  const [notice, setNotice] = useState<string | null>(null);
  const [requestError, setRequestError] = useState<string | null>(null);
  const query = useQuery({
    queryKey: ['admin-settings'],
    queryFn: () => requestJson<AdministrationSnapshot>('/api/admin/settings'),
  });

  const refresh = () => {
    setNotice(null);
    setRequestError(null);
    void queryClient.invalidateQueries({ queryKey: ['admin-settings'] });
  };

  const onSuccess = (message: string) => {
    setRequestError(null);
    setNotice(message);
    void queryClient.invalidateQueries({ queryKey: ['admin-settings'] });
  };

  const onError = (error: Error) => {
    setNotice(null);
    setRequestError(error.message);
  };

  if (query.isPending) {
    return <LoadingState label="Loading institution and academic settings..." />;
  }

  if (query.isError || !query.data) {
    return (
      <EmptyState
        title="Settings could not be loaded"
        description={query.error?.message ?? 'The administration data is unavailable.'}
        actionLabel="Retry"
        onAction={refresh}
      />
    );
  }

  return (
    <div className="max-w-6xl space-y-6">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <Badge variant="outline" className="border-blue-200 bg-blue-50 text-blue-700">
            Admin • INSTITUTION AND ACADEMIC SETTINGS
          </Badge>
          <h2 className="mt-1 text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
            Institution & System Settings
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Persist the school profile, active school year, grade levels, and sections.
          </p>
        </div>
        <div className="flex items-center gap-2 text-xs text-slate-500">
          <Shield className="h-4 w-4 text-blue-600" /> Administrator-only controls
        </div>
      </div>

      {notice && (
        <div
          role="status"
          className="flex items-center gap-2 rounded-md bg-emerald-50 px-3 py-2 text-xs text-emerald-700"
        >
          <CheckCircle2 className="h-4 w-4" /> {notice}
        </div>
      )}
      {requestError && (
        <p role="alert" className="rounded-md bg-red-50 px-3 py-2 text-xs text-red-700">
          {requestError}
        </p>
      )}

      <InstitutionProfile
        settings={query.data.settings}
        schoolYears={query.data.schoolYears}
        onSuccess={onSuccess}
        onError={onError}
      />
      <SchoolYearManagement
        schoolYears={query.data.schoolYears}
        onSuccess={onSuccess}
        onError={onError}
      />
      <AcademicStructureManagement
        gradeLevels={query.data.gradeLevels}
        schoolYears={query.data.schoolYears}
        sections={query.data.sections}
        onSuccess={onSuccess}
        onError={onError}
      />
    </div>
  );
}

function InstitutionProfile({
  settings,
  schoolYears,
  onSuccess,
  onError,
}: {
  settings: Settings;
  schoolYears: SchoolYear[];
  onSuccess: (message: string) => void;
  onError: (error: Error) => void;
}) {
  const [form, setForm] = useState(settings);
  const mutation = useMutation({
    mutationFn: (values: Settings) =>
      requestJson<Settings>('/api/admin/settings', {
        method: 'PATCH',
        body: JSON.stringify(values),
      }),
    onSuccess: () => onSuccess('Institution settings saved successfully.'),
    onError,
  });

  useEffect(() => setForm(settings), [settings]);

  return (
    <Card className="border-slate-200 shadow-sm dark:border-slate-800">
      <CardHeader className="border-b border-slate-100 dark:border-slate-800">
        <CardTitle className="flex items-center gap-2 text-base font-semibold">
          <Building2 className="h-4 w-4 text-blue-600" /> Institution profile and system defaults
        </CardTitle>
      </CardHeader>
      <CardContent>
        <form
          className="space-y-4 pt-2"
          onSubmit={(event) => {
            event.preventDefault();
            mutation.mutate(form);
          }}
        >
          <div className="grid gap-4 md:grid-cols-2">
            <Field label="Institution full name">
              <Input
                value={form.schoolName}
                onChange={(event) => setForm({ ...form, schoolName: event.target.value })}
                required
              />
            </Field>
            <Field label="Short name / abbreviation">
              <Input
                value={form.shortName}
                onChange={(event) => setForm({ ...form, shortName: event.target.value })}
                required
              />
            </Field>
            <Field label="Address">
              <Input
                value={form.address}
                onChange={(event) => setForm({ ...form, address: event.target.value })}
                required
              />
            </Field>
            <Field label="Contact email">
              <Input
                type="email"
                value={form.email}
                onChange={(event) => setForm({ ...form, email: event.target.value })}
                required
              />
            </Field>
            <Field label="Contact phone">
              <Input
                value={form.phone}
                onChange={(event) => setForm({ ...form, phone: event.target.value })}
                required
              />
            </Field>
            <Field label="Receipt prefix">
              <Input
                value={form.receiptPrefix}
                onChange={(event) => setForm({ ...form, receiptPrefix: event.target.value })}
                required
              />
            </Field>
            <Field label="Default payment term (days)">
              <Input
                type="number"
                min={1}
                max={365}
                value={form.defaultPaymentTermDays}
                onChange={(event) =>
                  setForm({ ...form, defaultPaymentTermDays: Number(event.target.value) })
                }
                required
              />
              <span className="mt-1 block text-xs font-normal text-slate-500">
                New posted assessments use this many Manila calendar days unless staff overrides the
                due date.
              </span>
            </Field>
            <Field label="Reminder lead time (days)">
              <Input
                type="number"
                min={0}
                max={30}
                value={form.reminderLeadDays}
                onChange={(event) =>
                  setForm({ ...form, reminderLeadDays: Number(event.target.value) })
                }
                required
              />
              <span className="mt-1 block text-xs font-normal text-slate-500">
                Reminder checks notify linked accounts this many days before a due date.
              </span>
            </Field>
            <div className="space-y-3 rounded-lg border border-blue-100 bg-blue-50/40 p-3 dark:border-blue-900/40 dark:bg-blue-950/20">
              <div className="flex items-center gap-3">
                <input
                  id="gcash-enabled"
                  type="checkbox"
                  checked={form.gcashEnabled}
                  onChange={(event) => setForm({ ...form, gcashEnabled: event.target.checked })}
                  className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                />
                <label htmlFor="gcash-enabled" className="text-sm font-semibold">
                  Enable GCash proof submissions
                </label>
              </div>
              <Input
                aria-label="GCash account name"
                value={form.gcashAccountName ?? ''}
                onChange={(event) =>
                  setForm({ ...form, gcashAccountName: event.target.value || null })
                }
                placeholder="Fictional school account name"
                disabled={!form.gcashEnabled}
              />
              <Input
                aria-label="GCash account number"
                value={form.gcashAccountNumber ?? ''}
                onChange={(event) =>
                  setForm({ ...form, gcashAccountNumber: event.target.value || null })
                }
                placeholder="Fictional school account number"
                disabled={!form.gcashEnabled}
              />
            </div>
            <div className="space-y-3 rounded-lg border border-emerald-100 bg-emerald-50/40 p-3 dark:border-emerald-900/40 dark:bg-emerald-950/20">
              <div className="flex items-center gap-3">
                <input
                  id="maya-enabled"
                  type="checkbox"
                  checked={form.mayaEnabled}
                  onChange={(event) => setForm({ ...form, mayaEnabled: event.target.checked })}
                  className="h-4 w-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                />
                <label htmlFor="maya-enabled" className="text-sm font-semibold">
                  Enable Maya proof submissions
                </label>
              </div>
              <Input
                aria-label="Maya account name"
                value={form.mayaAccountName ?? ''}
                onChange={(event) =>
                  setForm({ ...form, mayaAccountName: event.target.value || null })
                }
                placeholder="Fictional school account name"
                disabled={!form.mayaEnabled}
              />
              <Input
                aria-label="Maya account number"
                value={form.mayaAccountNumber ?? ''}
                onChange={(event) =>
                  setForm({ ...form, mayaAccountNumber: event.target.value || null })
                }
                placeholder="Fictional school account number"
                disabled={!form.mayaEnabled}
              />
            </div>
            <Field label="Active school year">
              <select
                value={form.activeSchoolYearId ?? ''}
                onChange={(event) =>
                  setForm({ ...form, activeSchoolYearId: event.target.value || null })
                }
                className="h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm dark:border-slate-800 dark:bg-slate-900"
              >
                <option value="">No active school year</option>
                {schoolYears
                  .filter((schoolYear) => schoolYear.status === 'ACTIVE')
                  .map((schoolYear) => (
                    <option key={schoolYear.id} value={schoolYear.id}>
                      {schoolYear.name}
                    </option>
                  ))}
              </select>
            </Field>
            <div className="flex items-center gap-3 pt-6">
              <input
                id="student-portal-enabled"
                type="checkbox"
                checked={form.studentPortalEnabled}
                onChange={(event) =>
                  setForm({ ...form, studentPortalEnabled: event.target.checked })
                }
                className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
              />
              <label htmlFor="student-portal-enabled" className="text-sm font-medium">
                Enable student portal access
              </label>
            </div>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-4 dark:border-slate-800">
            <p className="text-xs text-slate-500">
              Currency: {form.currencyCode} · Timezone: {form.timezone}
            </p>
            <Button type="submit" disabled={mutation.isPending} className="bg-blue-600 text-white">
              <Save className="mr-2 h-4 w-4" />
              {mutation.isPending ? 'Saving…' : 'Save configuration'}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

function SchoolYearManagement({
  schoolYears,
  onSuccess,
  onError,
}: {
  schoolYears: SchoolYear[];
  onSuccess: (message: string) => void;
  onError: (error: Error) => void;
}) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({ name: '', startDate: '', endDate: '' });
  const save = useMutation({
    mutationFn: async () => {
      const url = editingId ? `/api/admin/school-years/${editingId}` : '/api/admin/school-years';
      return requestJson<SchoolYear>(url, {
        method: editingId ? 'PATCH' : 'POST',
        body: JSON.stringify(form),
      });
    },
    onSuccess: () => {
      setEditingId(null);
      setForm({ name: '', startDate: '', endDate: '' });
      onSuccess(editingId ? 'School year updated.' : 'School year created as a draft.');
    },
    onError,
  });
  const activate = useMutation({
    mutationFn: (id: string) =>
      requestJson<SchoolYear>(`/api/admin/school-years/${id}/activate`, { method: 'POST' }),
    onSuccess: () => onSuccess('Active school year changed.'),
    onError,
  });

  const beginEdit = (schoolYear: SchoolYear) => {
    setEditingId(schoolYear.id);
    setForm({
      name: schoolYear.name,
      startDate: dateOnly(schoolYear.startDate),
      endDate: dateOnly(schoolYear.endDate),
    });
  };

  return (
    <Card className="border-slate-200 shadow-sm dark:border-slate-800">
      <CardHeader className="border-b border-slate-100 dark:border-slate-800">
        <CardTitle className="text-base font-semibold">School years</CardTitle>
      </CardHeader>
      <CardContent className="space-y-5 pt-5">
        <form
          className="grid gap-3 rounded-lg border border-dashed border-slate-300 p-4 dark:border-slate-700 md:grid-cols-[1.4fr_1fr_1fr_auto]"
          onSubmit={(event) => {
            event.preventDefault();
            save.mutate();
          }}
        >
          <Input
            aria-label="School year name"
            placeholder="e.g. SY 2026 to 2027"
            value={form.name}
            onChange={(event) => setForm({ ...form, name: event.target.value })}
            required
          />
          <Input
            aria-label="School year start date"
            type="date"
            value={form.startDate}
            onChange={(event) => setForm({ ...form, startDate: event.target.value })}
            required
          />
          <Input
            aria-label="School year end date"
            type="date"
            value={form.endDate}
            onChange={(event) => setForm({ ...form, endDate: event.target.value })}
            required
          />
          <div className="flex gap-2">
            <Button type="submit" disabled={save.isPending} className="bg-blue-600 text-white">
              {editingId ? <Save className="mr-2 h-4 w-4" /> : <Plus className="mr-2 h-4 w-4" />}
              {save.isPending ? 'Saving…' : editingId ? 'Update' : 'Add'}
            </Button>
            {editingId && (
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setEditingId(null);
                  setForm({ name: '', startDate: '', endDate: '' });
                }}
              >
                Cancel
              </Button>
            )}
          </div>
        </form>

        {schoolYears.length === 0 ? (
          <EmptyState
            title="No school years"
            description="Add the first school year to continue."
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b text-xs text-slate-500">
                <tr>
                  <th className="px-3 py-2">Name</th>
                  <th className="px-3 py-2">Dates</th>
                  <th className="px-3 py-2">Status</th>
                  <th className="px-3 py-2 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {schoolYears.map((schoolYear) => (
                  <tr key={schoolYear.id} className="border-b last:border-0">
                    <td className="px-3 py-3 font-medium">{schoolYear.name}</td>
                    <td className="px-3 py-3 text-xs text-slate-500">
                      {dateOnly(schoolYear.startDate)} to {dateOnly(schoolYear.endDate)}
                    </td>
                    <td className="px-3 py-3">
                      <Badge variant="outline" className={statusClass(schoolYear.status)}>
                        {schoolYear.status}
                      </Badge>
                    </td>
                    <td className="space-x-1 px-3 py-3 text-right">
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => beginEdit(schoolYear)}
                      >
                        <Edit className="mr-1 h-3.5 w-3.5" /> Edit
                      </Button>
                      {schoolYear.status !== 'ACTIVE' && (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          disabled={activate.isPending}
                          onClick={() => {
                            if (window.confirm(`Make ${schoolYear.name} the active school year?`)) {
                              activate.mutate(schoolYear.id);
                            }
                          }}
                        >
                          Activate
                        </Button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function AcademicStructureManagement({
  gradeLevels,
  schoolYears,
  sections,
  onSuccess,
  onError,
}: {
  gradeLevels: GradeLevel[];
  schoolYears: SchoolYear[];
  sections: Section[];
  onSuccess: (message: string) => void;
  onError: (error: Error) => void;
}) {
  const [editingGradeId, setEditingGradeId] = useState<string | null>(null);
  const [gradeForm, setGradeForm] = useState({ name: '', code: '', displayOrder: '0' });
  const [editingSectionId, setEditingSectionId] = useState<string | null>(null);
  const [sectionForm, setSectionForm] = useState({
    gradeLevelId: '',
    schoolYearId: '',
    name: '',
    code: '',
  });

  const saveGrade = useMutation({
    mutationFn: () =>
      requestJson<GradeLevel>(
        editingGradeId ? `/api/admin/grade-levels/${editingGradeId}` : '/api/admin/grade-levels',
        {
          method: editingGradeId ? 'PATCH' : 'POST',
          body: JSON.stringify({ ...gradeForm, displayOrder: Number(gradeForm.displayOrder) }),
        }
      ),
    onSuccess: () => {
      setEditingGradeId(null);
      setGradeForm({ name: '', code: '', displayOrder: '0' });
      onSuccess(editingGradeId ? 'Grade level updated.' : 'Grade level created.');
    },
    onError,
  });
  const saveSection = useMutation({
    mutationFn: () =>
      requestJson<Section>(
        editingSectionId ? `/api/admin/sections/${editingSectionId}` : '/api/admin/sections',
        {
          method: editingSectionId ? 'PATCH' : 'POST',
          body: JSON.stringify(sectionForm),
        }
      ),
    onSuccess: () => {
      setEditingSectionId(null);
      setSectionForm({ gradeLevelId: '', schoolYearId: '', name: '', code: '' });
      onSuccess(editingSectionId ? 'Section updated.' : 'Section created.');
    },
    onError,
  });

  const gradeName = (id: string) => gradeLevels.find((grade) => grade.id === id)?.name ?? 'Unknown';
  const yearName = (id: string) => schoolYears.find((year) => year.id === id)?.name ?? 'Unknown';

  return (
    <div className="grid gap-6 xl:grid-cols-2">
      <Card className="border-slate-200 shadow-sm dark:border-slate-800">
        <CardHeader className="border-b border-slate-100 dark:border-slate-800">
          <CardTitle className="text-base font-semibold">Grade levels</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 pt-5">
          <form
            className="grid gap-3 sm:grid-cols-[1fr_0.7fr_0.5fr_auto]"
            onSubmit={(event) => {
              event.preventDefault();
              saveGrade.mutate();
            }}
          >
            <Input
              aria-label="Grade level name"
              placeholder="Grade 7"
              value={gradeForm.name}
              onChange={(event) => setGradeForm({ ...gradeForm, name: event.target.value })}
              required
            />
            <Input
              aria-label="Grade level code"
              placeholder="G7"
              value={gradeForm.code}
              onChange={(event) => setGradeForm({ ...gradeForm, code: event.target.value })}
              required
            />
            <Input
              aria-label="Grade level display order"
              type="number"
              min="0"
              value={gradeForm.displayOrder}
              onChange={(event) => setGradeForm({ ...gradeForm, displayOrder: event.target.value })}
              required
            />
            <Button type="submit" disabled={saveGrade.isPending} className="bg-blue-600 text-white">
              {editingGradeId ? 'Update' : 'Add'}
            </Button>
          </form>
          {gradeLevels.length === 0 ? (
            <EmptyState
              title="No grade levels"
              description="Add grade levels before creating sections."
            />
          ) : (
            <div className="divide-y rounded-md border">
              {gradeLevels.map((grade) => (
                <div key={grade.id} className="flex items-center justify-between px-3 py-2 text-sm">
                  <span>
                    <strong>{grade.name}</strong>{' '}
                    <span className="text-xs text-slate-500">({grade.code})</span>
                  </span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setEditingGradeId(grade.id);
                      setGradeForm({
                        name: grade.name,
                        code: grade.code,
                        displayOrder: String(grade.displayOrder),
                      });
                    }}
                  >
                    <Edit className="mr-1 h-3.5 w-3.5" /> Edit
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="border-slate-200 shadow-sm dark:border-slate-800">
        <CardHeader className="border-b border-slate-100 dark:border-slate-800">
          <CardTitle className="text-base font-semibold">Sections</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 pt-5">
          <form
            className="grid gap-3 sm:grid-cols-2"
            onSubmit={(event) => {
              event.preventDefault();
              saveSection.mutate();
            }}
          >
            <select
              aria-label="Section grade level"
              value={sectionForm.gradeLevelId}
              onChange={(event) =>
                setSectionForm({ ...sectionForm, gradeLevelId: event.target.value })
              }
              className="h-10 rounded-md border border-slate-200 bg-white px-3 text-sm dark:border-slate-800 dark:bg-slate-900"
              required
            >
              <option value="">Select grade level</option>
              {gradeLevels.map((grade) => (
                <option key={grade.id} value={grade.id}>
                  {grade.name}
                </option>
              ))}
            </select>
            <select
              aria-label="Section school year"
              value={sectionForm.schoolYearId}
              onChange={(event) =>
                setSectionForm({ ...sectionForm, schoolYearId: event.target.value })
              }
              className="h-10 rounded-md border border-slate-200 bg-white px-3 text-sm dark:border-slate-800 dark:bg-slate-900"
              required
            >
              <option value="">Select school year</option>
              {schoolYears
                .filter((year) => year.status !== 'ARCHIVED')
                .map((year) => (
                  <option key={year.id} value={year.id}>
                    {year.name}
                  </option>
                ))}
            </select>
            <Input
              aria-label="Section name"
              placeholder="Section A"
              value={sectionForm.name}
              onChange={(event) => setSectionForm({ ...sectionForm, name: event.target.value })}
              required
            />
            <Input
              aria-label="Section code"
              placeholder="G7-A"
              value={sectionForm.code}
              onChange={(event) => setSectionForm({ ...sectionForm, code: event.target.value })}
              required
            />
            <Button
              type="submit"
              disabled={
                saveSection.isPending || gradeLevels.length === 0 || schoolYears.length === 0
              }
              className="bg-blue-600 text-white sm:col-span-2"
            >
              {editingSectionId ? 'Update section' : 'Add section'}
            </Button>
          </form>
          {sections.length === 0 ? (
            <EmptyState
              title="No sections"
              description="Create a section for an active or draft school year."
            />
          ) : (
            <div className="divide-y rounded-md border">
              {sections.map((section) => (
                <div
                  key={section.id}
                  className="flex items-center justify-between gap-3 px-3 py-2 text-sm"
                >
                  <div>
                    <strong>{section.name}</strong>{' '}
                    <span className="text-xs text-slate-500">{section.code}</span>
                    <p className="text-[11px] text-slate-500">
                      {gradeName(section.gradeLevelId)} · {yearName(section.schoolYearId)}
                    </p>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setEditingSectionId(section.id);
                      setSectionForm({
                        gradeLevelId: section.gradeLevelId,
                        schoolYearId: section.schoolYearId,
                        name: section.name,
                        code: section.code,
                      });
                    }}
                  >
                    <Edit className="mr-1 h-3.5 w-3.5" /> Edit
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="space-y-1 text-xs font-semibold text-slate-700 dark:text-slate-300">
      <span>{label}</span>
      {children}
    </label>
  );
}
