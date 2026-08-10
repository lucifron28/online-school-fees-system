import React from 'react';
import { Sidebar } from '@/components/layout/sidebar';
import { Header } from '@/components/layout/header';
import { requirePortalUser } from '@/server/auth/guards';

export const dynamic = 'force-dynamic';

export default async function StudentLayout({ children }: { children: React.ReactNode }) {
  const user = await requirePortalUser(['STUDENT'], '/login/student');

  return (
    <div className="flex min-h-screen bg-slate-50 text-slate-900 dark:bg-slate-950 dark:text-slate-50">
      <Sidebar role="student" userName={user.name} logoutPath="/login/student" />
      <div className="flex flex-1 flex-col overflow-hidden">
        <Header
          userName={user.name}
          userRole="Student"
          logoutPath="/login/student"
          notificationsPath="/student/notifications"
        />
        <main className="flex-1 overflow-y-auto p-6 lg:p-8">{children}</main>
      </div>
    </div>
  );
}
