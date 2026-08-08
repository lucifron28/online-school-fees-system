'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Bell, RefreshCw } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { getClientErrorMessage, requestJson } from '@/lib/client-api';

interface NotificationHistoryItem {
  id: string;
  userName: string | null;
  userEmail: string | null;
  type: string;
  title: string;
  body: string;
  createdAt: string;
  deliveryChannel: string | null;
  deliveryStatus: string | null;
  attemptCount: number | null;
  sentAt: string | null;
  errorMessage: string | null;
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat('en-PH', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: 'Asia/Manila',
  }).format(new Date(value));
}

function statusVariant(status: string | null) {
  if (status === 'SENT') return 'success' as const;
  if (status === 'FAILED') return 'destructive' as const;
  return 'outline' as const;
}

export function NotificationHistory({ audit = false }: { audit?: boolean }) {
  const [retryingId, setRetryingId] = useState<string | null>(null);
  const query = useQuery({
    queryKey: ['notifications', audit],
    queryFn: () =>
      requestJson<NotificationHistoryItem[]>(
        `/api/notifications?limit=100${audit ? '&scope=all' : ''}`
      ),
  });

  async function retryNotification(notificationId: string) {
    setRetryingId(notificationId);
    try {
      await requestJson(`/api/notifications/${notificationId}/retry`, { method: 'POST' });
      await query.refetch();
    } finally {
      setRetryingId(null);
    }
  }

  if (query.isLoading) {
    return (
      <Card>
        <CardContent className="p-6 text-sm text-slate-500">
          Loading notification history…
        </CardContent>
      </Card>
    );
  }

  if (query.isError) {
    return (
      <Card>
        <CardContent className="flex items-center justify-between gap-4 p-6">
          <p className="text-sm text-red-600">{getClientErrorMessage(query.error)}</p>
          <Button variant="outline" size="sm" onClick={() => void query.refetch()}>
            <RefreshCw className="mr-1.5 h-3.5 w-3.5" /> Retry
          </Button>
        </CardContent>
      </Card>
    );
  }

  const notifications = query.data ?? [];
  if (notifications.length === 0) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center gap-2 p-10 text-center">
          <Bell className="h-8 w-8 text-slate-300" />
          <p className="text-sm font-medium text-slate-700 dark:text-slate-200">
            No notification history yet.
          </p>
          <p className="text-xs text-slate-500">
            Financial and assessment events will appear here.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-3">
      {notifications.map((notification) => (
        <Card key={notification.id}>
          <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0 space-y-1">
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="font-semibold text-slate-900 dark:text-slate-100">
                  {notification.title}
                </h3>
                <Badge variant="outline">{notification.type.replaceAll('_', ' ')}</Badge>
                {audit && notification.userEmail && (
                  <span className="text-xs text-slate-500">{notification.userEmail}</span>
                )}
              </div>
              <p className="text-sm text-slate-600 dark:text-slate-300">{notification.body}</p>
              <p className="text-xs text-slate-500">{formatDate(notification.createdAt)}</p>
              {notification.errorMessage && (
                <p className="text-xs text-red-600">Delivery error: {notification.errorMessage}</p>
              )}
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <Badge variant={statusVariant(notification.deliveryStatus)}>
                {notification.deliveryStatus ?? 'PENDING'}
              </Badge>
              <span className="text-[11px] text-slate-500">
                {notification.deliveryChannel ?? 'EMAIL'} · {notification.attemptCount ?? 0}{' '}
                attempt(s)
              </span>
              {audit && notification.deliveryStatus === 'FAILED' && (
                <Button
                  variant="outline"
                  size="sm"
                  disabled={retryingId === notification.id}
                  onClick={() => void retryNotification(notification.id)}
                >
                  {retryingId === notification.id ? 'Retrying…' : 'Retry'}
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
