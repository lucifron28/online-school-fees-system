import React from 'react';
import Link from 'next/link';
import { Bell, Search, User } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { LogoutButton } from '@/components/auth/logout-button';

interface HeaderProps {
  title?: string;
  subtitle?: string;
  userName?: string;
  userRole?: string;
  logoutPath?: string;
  notificationsPath?: string;
}

export function Header({
  title = 'Dashboard',
  subtitle,
  userName = 'Administrator',
  userRole = 'Administrator',
  logoutPath = '/login/admin',
  notificationsPath = '/admin/notifications',
}: HeaderProps) {
  return (
    <header className="sticky top-0 z-30 flex h-16 w-full items-center justify-between border-b border-slate-200 bg-white/90 px-6 shadow-sm backdrop-blur-md dark:border-slate-800 dark:bg-slate-900/90">
      <div>
        <h1 className="text-lg font-semibold tracking-tight text-slate-900 dark:text-slate-100">
          {title}
        </h1>
        {subtitle && <p className="text-xs text-slate-500 dark:text-slate-400">{subtitle}</p>}
      </div>

      <div className="flex items-center space-x-4">
        {/* Quick Search */}
        <div className="relative hidden w-64 md:block">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-slate-400" />
          <Input
            type="search"
            placeholder="Search students, OR..."
            className="h-9 bg-slate-50 pl-9 text-xs dark:bg-slate-800"
          />
        </div>

        {/* Notifications */}
        <Link
          href={notificationsPath}
          aria-label="Open notifications"
          className="relative rounded-full p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-700 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-200"
        >
          <Bell className="h-5 w-5" />
          <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-blue-600 ring-2 ring-white dark:ring-slate-900" />
        </Link>

        {/* User Pill */}
        <div className="flex items-center space-x-3 border-l border-slate-200 pl-4 dark:border-slate-800">
          <div className="flex h-8 w-8 items-center justify-center rounded-full border border-blue-200 bg-blue-100 text-xs font-semibold text-blue-700 dark:border-blue-800 dark:bg-blue-900/60 dark:text-blue-300">
            <User className="h-4 w-4" />
          </div>
          <div className="hidden text-left sm:block">
            <p className="text-xs font-semibold leading-tight text-slate-900 dark:text-slate-100">
              {userName}
            </p>
            <p className="text-[10px] text-slate-500 dark:text-slate-400">{userRole}</p>
          </div>
        </div>

        <LogoutButton
          logoutPath={logoutPath}
          className="hidden p-2 text-slate-500 hover:bg-slate-100 hover:text-red-600 dark:text-slate-400 dark:hover:bg-slate-800 sm:flex"
        />
      </div>
    </header>
  );
}
