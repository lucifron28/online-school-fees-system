import React from 'react';
import { Sidebar } from '@/components/layout/sidebar';
import { Header } from '@/components/layout/header';
import { requirePortalUser } from '@/server/auth/guards';

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = await requirePortalUser(['ADMIN', 'FINANCE_STAFF'], '/login/admin');
  const userRole = user.role === 'FINANCE_STAFF' ? 'Finance Staff' : 'Administrator';

  return (
    <div className="flex min-h-screen bg-slate-50 text-slate-900 dark:bg-slate-950 dark:text-slate-50">
      <Sidebar role="admin" userName={user.name} logoutPath="/login/admin" />
      <div className="flex flex-1 flex-col overflow-hidden">
        <Header userName={user.name} userRole={userRole} logoutPath="/login/admin" />
        <main className="flex-1 overflow-y-auto p-6 lg:p-8">{children}</main>
      </div>
    </div>
  );
}
