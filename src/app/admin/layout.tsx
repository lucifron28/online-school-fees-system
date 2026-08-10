import React from 'react';
import { Sidebar } from '@/components/layout/sidebar';
import { Header } from '@/components/layout/header';
import { requirePortalUser } from '@/server/auth/guards';

export const dynamic = 'force-dynamic';

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = await requirePortalUser(['ADMIN', 'FINANCE_STAFF'], '/login/admin');
  const userRole = user.role === 'FINANCE_STAFF' ? 'Finance Staff' : 'Administrator';

  return (
    <div className="flex min-h-[100dvh] flex-col bg-background text-foreground lg:flex-row">
      <Sidebar
        role={user.role === 'FINANCE_STAFF' ? 'finance' : 'admin'}
        userName={user.name}
        logoutPath="/login/admin"
      />
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <Header
          userName={user.name}
          userRole={userRole}
          logoutPath="/login/admin"
          notificationsPath="/admin/notifications"
        />
        <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8">{children}</main>
      </div>
    </div>
  );
}
