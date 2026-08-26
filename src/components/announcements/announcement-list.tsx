'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Archive,
  BellRing,
  CalendarClock,
  Megaphone,
  Pencil,
  RefreshCw,
  Search,
  Send,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { Input } from '@/components/ui/input';
import { LoadingState } from '@/components/ui/loading-state';
import { PaginationControls } from '@/components/ui/pagination-controls';
import { getClientErrorMessage, requestJson } from '@/lib/client-api';

type Audience = 'PARENT' | 'STUDENT' | 'PARENT_AND_STUDENT';
type Status = 'DRAFT' | 'SCHEDULED' | 'PUBLISHED' | 'ARCHIVED';

type Announcement = {
  id: string;
  title: string;
  body: string;
  audience: Audience;
  status: Status;
  publishAt: string;
  expiresAt: string | null;
  createdAt: string;
  updatedAt: string;
};

type FormState = {
  title: string;
  body: string;
  audience: Audience;
  status: 'DRAFT' | 'SCHEDULED' | 'PUBLISHED';
  publishAt: string;
  expiresAt: string;
};

function localDateTime(value: Date) {
  const offset = value.getTimezoneOffset() * 60_000;
  return new Date(value.getTime() - offset).toISOString().slice(0, 16);
}

function statusClass(status: Status) {
  if (status === 'PUBLISHED') return 'border-emerald-200 bg-emerald-50 text-emerald-700';
  if (status === 'SCHEDULED') return 'border-blue-200 bg-blue-50 text-blue-700';
  if (status === 'ARCHIVED') return 'border-slate-200 bg-slate-100 text-slate-600';
  return 'border-amber-200 bg-amber-50 text-amber-700';
}

function audienceLabel(audience: Audience) {
  return audience === 'PARENT_AND_STUDENT'
    ? 'Parents and students'
    : audience === 'PARENT'
      ? 'Parents'
      : 'Students';
}

function displayDate(value: string | null) {
  if (!value) return 'No expiry';
  return new Intl.DateTimeFormat('en-PH', { dateStyle: 'medium', timeStyle: 'short' }).format(
    new Date(value)
  );
}

const emptyForm = (): FormState => ({
  title: '',
  body: '',
  audience: 'PARENT_AND_STUDENT',
  status: 'DRAFT',
  publishAt: localDateTime(new Date()),
  expiresAt: '',
});

export function AdminAnnouncementManagement() {
  const queryClient = useQueryClient();
  const [form, setForm] = useState<FormState>(emptyForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [audienceFilter, setAudienceFilter] = useState<string>('');
  const [search, setSearch] = useState<string>('');

  const query = useQuery({
    queryKey: ['admin-announcements', page, statusFilter, audienceFilter, search],
    queryFn: () => {
      const params = new URLSearchParams({ page: String(page), pageSize: '20' });
      if (statusFilter) params.set('status', statusFilter);
      if (audienceFilter) params.set('audience', audienceFilter);
      if (search.trim()) params.set('search', search.trim());
      return requestJson<{
        items: Announcement[];
        pagination: { page: number; pageSize: number; total: number; pageCount: number };
      }>(`/api/admin/announcements?${params.toString()}`);
    },
  });
  const items = useMemo(() => query.data?.items ?? [], [query.data?.items]);
  const pagination = query.data?.pagination;
  const refresh = () => void queryClient.invalidateQueries({ queryKey: ['admin-announcements'] });
  const save = useMutation({
    mutationFn: () =>
      requestJson<Announcement>(
        editingId ? `/api/admin/announcements/${editingId}` : '/api/admin/announcements',
        {
          method: editingId ? 'PATCH' : 'POST',
          body: JSON.stringify({
            ...form,
            publishAt: new Date(form.publishAt).toISOString(),
            expiresAt: form.expiresAt ? new Date(form.expiresAt).toISOString() : null,
          }),
        }
      ),
    onSuccess: () => {
      setEditingId(null);
      setForm(emptyForm());
      setNotice(editingId ? 'Announcement updated.' : 'Announcement saved.');
      setError(null);
      refresh();
    },
    onError: (value) => {
      setNotice(null);
      setError(getClientErrorMessage(value));
    },
  });
  const publish = useMutation({
    mutationFn: (id: string) =>
      requestJson<Announcement>(`/api/admin/announcements/${id}/publish`, { method: 'POST' }),
    onSuccess: () => {
      setNotice('Announcement published and notifications were deduplicated per recipient.');
      setError(null);
      refresh();
    },
    onError: (value) => setError(getClientErrorMessage(value)),
  });
  const archive = useMutation({
    mutationFn: (id: string) =>
      requestJson<Announcement>(`/api/admin/announcements/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      setNotice('Announcement archived.');
      setError(null);
      refresh();
    },
    onError: (value) => setError(getClientErrorMessage(value)),
  });

  const beginEdit = (announcement: Announcement) => {
    if (announcement.status === 'ARCHIVED') return;
    setEditingId(announcement.id);
    setForm({
      title: announcement.title,
      body: announcement.body,
      audience: announcement.audience,
      status: announcement.status,
      publishAt: localDateTime(new Date(announcement.publishAt)),
      expiresAt: announcement.expiresAt ? localDateTime(new Date(announcement.expiresAt)) : '',
    });
    setNotice(null);
    setError(null);
  };

  if (query.isPending) return <LoadingState label="Loading payment announcements..." />;
  if (query.isError || !query.data) {
    return (
      <EmptyState
        title="Announcements could not be loaded"
        description={getClientErrorMessage(query.error)}
        actionLabel="Retry"
        onAction={refresh}
      />
    );
  }

  return (
    <div className="space-y-6">
      {notice && (
        <p className="rounded-md bg-emerald-50 px-3 py-2 text-xs text-emerald-700">{notice}</p>
      )}
      {error && (
        <p role="alert" className="rounded-md bg-red-50 px-3 py-2 text-xs text-red-700">
          {error}
        </p>
      )}
      <Card className="border-slate-200 shadow-sm dark:border-slate-800">
        <CardHeader className="border-b border-slate-100 dark:border-slate-800">
          <CardTitle className="flex items-center gap-2 text-base font-semibold">
            <Megaphone className="h-4 w-4 text-blue-600" />{' '}
            {editingId ? 'Edit announcement' : 'Create announcement'}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form
            className="grid gap-4 pt-2"
            onSubmit={(event) => {
              event.preventDefault();
              save.mutate();
            }}
          >
            <label className="grid gap-1 text-xs font-medium" htmlFor="announcement-title">
              Announcement title
              <Input
                id="announcement-title"
                placeholder="Payment office schedule"
                value={form.title}
                onChange={(event) => setForm({ ...form, title: event.target.value })}
                required
              />
            </label>
            <label className="grid gap-1 text-xs font-medium" htmlFor="announcement-body">
              Announcement body
              <textarea
                id="announcement-body"
                className="min-h-28 rounded-md border border-slate-200 bg-white px-3 py-2 text-sm outline-none ring-offset-background placeholder:text-slate-400 focus:ring-2 focus:ring-blue-500 dark:border-slate-800 dark:bg-slate-900"
                placeholder="Share a payment-related update with families."
                value={form.body}
                onChange={(event) => setForm({ ...form, body: event.target.value })}
                required
              />
            </label>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <label className="grid gap-1 text-xs font-medium">
                Audience
                <select
                  value={form.audience}
                  onChange={(event) =>
                    setForm({ ...form, audience: event.target.value as Audience })
                  }
                  className="h-10 rounded-md border border-slate-200 bg-white px-3 text-sm dark:border-slate-800 dark:bg-slate-900"
                >
                  <option value="PARENT_AND_STUDENT">Parents and students</option>
                  <option value="PARENT">Parents</option>
                  <option value="STUDENT">Students</option>
                </select>
              </label>
              <label className="grid gap-1 text-xs font-medium">
                Lifecycle
                <select
                  value={form.status}
                  onChange={(event) =>
                    setForm({ ...form, status: event.target.value as FormState['status'] })
                  }
                  className="h-10 rounded-md border border-slate-200 bg-white px-3 text-sm dark:border-slate-800 dark:bg-slate-900"
                >
                  <option value="DRAFT">Draft</option>
                  <option value="SCHEDULED">Scheduled</option>
                  {editingId && form.status === 'PUBLISHED' && (
                    <option value="PUBLISHED">Published (preserved)</option>
                  )}
                </select>
              </label>
              <label className="grid gap-1 text-xs font-medium">
                Publish at
                <Input
                  type="datetime-local"
                  value={form.publishAt}
                  disabled={form.status === 'PUBLISHED'}
                  onChange={(event) => setForm({ ...form, publishAt: event.target.value })}
                  required
                />
              </label>
              <label className="grid gap-1 text-xs font-medium">
                Expires at
                <Input
                  type="datetime-local"
                  value={form.expiresAt}
                  onChange={(event) => setForm({ ...form, expiresAt: event.target.value })}
                />
              </label>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                type="submit"
                disabled={save.isPending}
                className="bg-blue-600 text-white hover:bg-blue-700"
              >
                {save.isPending
                  ? 'Saving…'
                  : editingId
                    ? 'Update announcement'
                    : 'Save announcement'}
              </Button>
              {editingId && (
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setEditingId(null);
                    setForm(emptyForm());
                  }}
                >
                  Cancel
                </Button>
              )}
            </div>
          </form>
        </CardContent>
      </Card>

      <Card className="border-slate-200 shadow-sm dark:border-slate-800">
        <CardHeader className="space-y-3">
          <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
            <CardTitle className="text-base font-semibold">Announcement archive</CardTitle>
            <Button variant="outline" size="sm" className="h-8 text-xs" onClick={refresh}>
              <RefreshCw className="mr-1.5 h-3.5 w-3.5" /> Refresh
            </Button>
          </div>
          <div className="grid gap-3 sm:grid-cols-[1fr_0.6fr_0.6fr]">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
              <Input
                placeholder="Search announcements..."
                className="h-9 pl-9 text-xs"
                value={search}
                onChange={(event) => {
                  setSearch(event.target.value);
                  setPage(1);
                }}
              />
            </div>
            <select
              value={statusFilter}
              onChange={(event) => {
                setStatusFilter(event.target.value);
                setPage(1);
              }}
              className="h-9 rounded-md border border-slate-200 bg-white px-3 text-xs dark:border-slate-800 dark:bg-slate-900"
            >
              <option value="">All statuses</option>
              <option value="DRAFT">Draft</option>
              <option value="SCHEDULED">Scheduled</option>
              <option value="PUBLISHED">Published</option>
              <option value="ARCHIVED">Archived</option>
            </select>
            <select
              value={audienceFilter}
              onChange={(event) => {
                setAudienceFilter(event.target.value);
                setPage(1);
              }}
              className="h-9 rounded-md border border-slate-200 bg-white px-3 text-xs dark:border-slate-800 dark:bg-slate-900"
            >
              <option value="">All audiences</option>
              <option value="PARENT_AND_STUDENT">Parents and students</option>
              <option value="PARENT">Parents</option>
              <option value="STUDENT">Students</option>
            </select>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {items.length === 0 && (
            <p className="text-sm text-slate-500">No announcements match the current filters.</p>
          )}
          {items.map((announcement) => (
            <article
              key={announcement.id}
              className="rounded-lg border border-slate-200 p-4 dark:border-slate-800"
            >
              <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="font-semibold text-slate-900 dark:text-slate-100">
                      {announcement.title}
                    </h3>
                    <Badge variant="outline" className={statusClass(announcement.status)}>
                      {announcement.status}
                    </Badge>
                  </div>
                  <p className="mt-1 text-xs text-slate-500">
                    {audienceLabel(announcement.audience)} · publishes{' '}
                    {displayDate(announcement.publishAt)} · {displayDate(announcement.expiresAt)}
                  </p>
                  <p className="mt-3 whitespace-pre-wrap text-sm text-slate-700 dark:text-slate-300">
                    {announcement.body}
                  </p>
                </div>
                <div className="flex shrink-0 flex-wrap gap-1">
                  {announcement.status !== 'ARCHIVED' && (
                    <Button variant="ghost" size="sm" onClick={() => beginEdit(announcement)}>
                      <Pencil className="mr-1 h-3.5 w-3.5" /> Edit
                    </Button>
                  )}
                  {announcement.status !== 'PUBLISHED' && announcement.status !== 'ARCHIVED' && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => publish.mutate(announcement.id)}
                      disabled={publish.isPending}
                    >
                      <Send className="mr-1 h-3.5 w-3.5" /> Publish
                    </Button>
                  )}
                  {announcement.status !== 'ARCHIVED' && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => archive.mutate(announcement.id)}
                      disabled={archive.isPending}
                    >
                      <Archive className="mr-1 h-3.5 w-3.5" /> Archive
                    </Button>
                  )}
                </div>
              </div>
            </article>
          ))}
          {pagination && (
            <PaginationControls
              {...pagination}
              isFetching={query.isFetching}
              onPageChange={setPage}
            />
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export function PortalAnnouncementList({ audience }: { audience: 'PARENT' | 'STUDENT' }) {
  const query = useQuery({
    queryKey: ['portal-announcements', audience],
    queryFn: () => requestJson<Announcement[]>('/api/portal/announcements'),
  });
  const announcements = useMemo(() => query.data ?? [], [query.data]);

  if (query.isPending) return <LoadingState label="Loading announcements..." />;
  if (query.isError) {
    return (
      <p role="alert" className="rounded-md bg-red-50 px-3 py-2 text-xs text-red-700">
        {getClientErrorMessage(query.error)}
      </p>
    );
  }
  if (announcements.length === 0) {
    return (
      <EmptyState
        title="No current announcements"
        description="Payment-related updates will appear here when published."
      />
    );
  }
  return (
    <div className="space-y-3">
      {announcements.map((announcement) => (
        <Card key={announcement.id} className="border-slate-200 shadow-sm dark:border-slate-800">
          <CardContent className="p-5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <Badge
                  variant="outline"
                  className={
                    audience === 'PARENT'
                      ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                      : 'border-sky-200 bg-sky-50 text-sky-700'
                  }
                >
                  <BellRing className="mr-1 h-3.5 w-3.5" /> Payment update
                </Badge>
                <h3 className="mt-2 text-lg font-semibold">{announcement.title}</h3>
              </div>
              <CalendarClock className="h-4 w-4 shrink-0 text-slate-400" />
            </div>
            <p className="mt-1 text-xs text-slate-500">
              Published {displayDate(announcement.publishAt)}
            </p>
            <p className="mt-4 whitespace-pre-wrap text-sm leading-6 text-slate-700 dark:text-slate-300">
              {announcement.body}
            </p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

export function PortalAnnouncementPreview({ audience }: { audience: 'PARENT' | 'STUDENT' }) {
  const query = useQuery({
    queryKey: ['portal-announcements', audience],
    queryFn: () => requestJson<Announcement[]>('/api/portal/announcements'),
  });
  const announcements = useMemo(() => (query.data ?? []).slice(0, 3), [query.data]);
  const href = audience === 'PARENT' ? '/parent/announcements' : '/student/announcements';

  const previewState = query.isPending ? 'loading' : query.isError ? 'error' : 'ready';

  return (
    <Card
      data-testid="portal-announcements-preview"
      data-announcements-state={previewState}
      aria-busy={query.isPending}
      className="border-slate-200 shadow-sm dark:border-slate-800"
    >
      <CardHeader className="flex flex-row items-center justify-between gap-3 pb-3">
        <div>
          <CardTitle className="text-base">Payment announcements</CardTitle>
          <p className="text-xs text-slate-500">Current published payment updates.</p>
        </div>
        <Link href={href} className="text-xs font-semibold text-blue-600 hover:underline">
          View all
        </Link>
      </CardHeader>
      <CardContent className="space-y-3">
        {query.isPending && (
          <div className="space-y-3" role="status" aria-label="Loading announcements">
            {[0, 1].map((item) => (
              <div
                key={item}
                className="animate-pulse rounded-lg border border-slate-100 p-3 dark:border-slate-800"
              >
                <div className="h-3 w-2/5 rounded bg-slate-200 dark:bg-slate-700" />
                <div className="mt-3 h-2.5 w-full rounded bg-slate-100 dark:bg-slate-800" />
                <div className="mt-2 h-2.5 w-4/5 rounded bg-slate-100 dark:bg-slate-800" />
                <div className="mt-3 h-2 w-1/3 rounded bg-slate-100 dark:bg-slate-800" />
              </div>
            ))}
          </div>
        )}
        {query.isError && (
          <div
            role="alert"
            className="flex items-center justify-between gap-3 rounded-md bg-red-50 px-3 py-2 text-xs text-red-700"
          >
            <span>{getClientErrorMessage(query.error)}</span>
            <Button
              variant="outline"
              size="sm"
              className="h-8 shrink-0 text-xs"
              onClick={() => void query.refetch()}
            >
              <RefreshCw className="mr-1 h-3.5 w-3.5" /> Retry
            </Button>
          </div>
        )}
        {query.data && announcements.length === 0 && (
          <p className="text-sm text-slate-500">No current payment announcements.</p>
        )}
        {announcements.map((announcement) => (
          <article key={announcement.id} className="rounded-lg border border-slate-100 p-3">
            <div className="flex items-center gap-2">
              <BellRing className="h-3.5 w-3.5 text-emerald-600" />
              <h3 className="text-sm font-semibold">{announcement.title}</h3>
            </div>
            <p className="mt-1 line-clamp-2 whitespace-pre-wrap text-xs leading-5 text-slate-600">
              {announcement.body}
            </p>
            <p className="mt-2 text-[11px] text-slate-400">
              Published {displayDate(announcement.publishAt)}
            </p>
          </article>
        ))}
      </CardContent>
    </Card>
  );
}
