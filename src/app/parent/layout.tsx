import React from 'react';
import { Sidebar } from '@/components/layout/sidebar';
import { Header } from '@/components/layout/header';
import { requirePortalUser } from '@/server/auth/guards';

export const dynamic = 'force-dynamic';

export default async function ParentLayout({ children }: { children: React.ReactNode }) {
  const user = await requirePortalUser(['PARENT'], '/login/parent');

  return (
    <div className="flex min-h-[100dvh] flex-col bg-background text-foreground lg:flex-row">
      <Sidebar role="parent" userName={user.name} logoutPath="/login/parent" />
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <Header
          userName={user.name}
          userRole="Parent / Guardian"
          logoutPath="/login/parent"
          notificationsPath="/parent/notifications"
        />
        <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8">{children}</main>
      </div>
    </div>
  );
}
