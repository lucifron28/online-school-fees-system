import React from 'react';
import { Sidebar } from '@/components/layout/sidebar';
import { Header } from '@/components/layout/header';
import { requirePortalUser } from '@/server/auth/guards';

export const dynamic = 'force-dynamic';

export default async function StudentLayout({ children }: { children: React.ReactNode }) {
  const user = await requirePortalUser(['STUDENT'], '/login/student');

  return (
    <div className="flex h-[100dvh] flex-col overflow-hidden bg-background text-foreground lg:flex-row">
      <Sidebar role="student" userName={user.name} logoutPath="/login/student" />
      <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
        <Header
          userName={user.name}
          userRole="Student"
          logoutPath="/login/student"
          notificationsPath="/student/notifications"
        />
        <main className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8">{children}</main>
      </div>
    </div>
  );
}
