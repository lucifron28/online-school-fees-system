'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import { LogoutButton } from '@/components/auth/logout-button';
import {
  LayoutDashboard,
  Users,
  CreditCard,
  Receipt,
  FileText,
  Settings,
  UserCheck,
  Building2,
  ChevronRight,
  Shield,
  GraduationCap,
  History,
  BellRing,
  Wallet,
} from 'lucide-react';

export type Role = 'admin' | 'parent' | 'student';

interface SidebarProps {
  role: Role;
  userName?: string;
  logoutPath?: string;
}

export function Sidebar({
  role,
  userName = 'Authenticated user',
  logoutPath = '/login/admin',
}: SidebarProps) {
  const pathname = usePathname();

  const adminNav = [
    { name: 'Dashboard', href: '/admin/dashboard', icon: LayoutDashboard },
    { name: 'Students', href: '/admin/students', icon: Users },
    { name: 'Guardians', href: '/admin/guardians', icon: UserCheck },
    { name: 'Fees Management', href: '/admin/fees', icon: CreditCard },
    { name: 'Payments (OTC)', href: '/admin/payments/manual', icon: Wallet },
    { name: 'Transactions', href: '/admin/transactions', icon: Receipt },
    { name: 'Reports', href: '/admin/reports', icon: FileText },
    { name: 'Notifications', href: '/admin/notifications', icon: BellRing },
    { name: 'Users', href: '/admin/users', icon: UserCheck },
    { name: 'Settings', href: '/admin/settings', icon: Settings },
  ];

  const parentNav = [
    { name: 'Dashboard', href: '/parent/dashboard', icon: LayoutDashboard },
    { name: 'My Children', href: '/parent/dashboard', icon: Users },
    { name: 'Payment History', href: '/parent/history', icon: History },
    { name: 'Make Payment', href: '/parent/pay', icon: CreditCard },
    { name: 'Notifications', href: '/parent/notifications', icon: BellRing },
  ];

  const studentNav = [
    { name: 'Dashboard', href: '/student/dashboard', icon: LayoutDashboard },
    { name: 'My Account', href: '/student/account', icon: GraduationCap },
    { name: 'Payment History', href: '/student/history', icon: History },
    { name: 'Notifications', href: '/student/notifications', icon: BellRing },
  ];

  const navItems = role === 'admin' ? adminNav : role === 'parent' ? parentNav : studentNav;

  const roleTitle =
    role === 'admin'
      ? 'Administrator Portal'
      : role === 'parent'
        ? 'Parent Portal'
        : 'Student Portal';
  const roleBadge = role === 'admin' ? 'ADMIN' : role === 'parent' ? 'PARENT' : 'STUDENT';
  const roleColor =
    role === 'admin'
      ? 'bg-blue-600/20 text-blue-400 border-blue-500/30'
      : role === 'parent'
        ? 'bg-emerald-600/20 text-emerald-400 border-emerald-500/30'
        : 'bg-purple-600/20 text-purple-400 border-purple-500/30';

  return (
    <aside className="flex min-h-screen w-64 flex-shrink-0 flex-col border-r border-slate-800 bg-slate-900 text-slate-100 shadow-xl">
      {/* Brand Header */}
      <div className="flex items-center space-x-3 border-b border-slate-800 p-4">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-600 font-bold text-white shadow-md">
          <Building2 className="h-5 w-5" />
        </div>
        <div>
          <h2 className="text-sm font-semibold tracking-tight text-white">School Fees</h2>
          <span
            className={cn(
              'mt-0.5 inline-block rounded border px-2 py-0.5 font-mono text-[10px] font-bold',
              roleColor
            )}
          >
            {roleBadge}
          </span>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 space-y-1 overflow-y-auto p-3">
        <div className="px-3 py-2 text-xs font-semibold uppercase tracking-wider text-slate-400">
          Navigation
        </div>
        {navItems.map((item) => {
          const isActive =
            pathname === item.href ||
            (item.href !== `/${role}/dashboard` && pathname.startsWith(item.href));
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'group flex items-center justify-between rounded-lg px-3.5 py-2.5 text-sm font-medium transition-all',
                isActive
                  ? 'bg-blue-600 font-semibold text-white shadow-md'
                  : 'text-slate-300 hover:bg-slate-800/80 hover:text-white'
              )}
            >
              <div className="flex items-center space-x-3">
                <Icon
                  className={cn(
                    'h-4 w-4',
                    isActive ? 'text-white' : 'text-slate-400 group-hover:text-white'
                  )}
                />
                <span>{item.name}</span>
              </div>
              {isActive && <ChevronRight className="h-4 w-4 text-white/80" />}
            </Link>
          );
        })}
      </nav>

      {/* Footer User Info & Logout */}
      <div className="space-y-2 border-t border-slate-800 p-3">
        <div className="flex items-center justify-between rounded-lg bg-slate-800/50 px-3 py-2 text-xs">
          <div className="flex items-center space-x-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-full bg-slate-700 font-bold text-slate-200">
              {role === 'admin' ? 'A' : role === 'parent' ? 'P' : 'S'}
            </div>
            <div>
              <p className="max-w-[110px] truncate font-medium text-slate-200">{userName}</p>
              <p className="text-[10px] capitalize text-slate-400">{role}</p>
            </div>
          </div>
        </div>

        <LogoutButton logoutPath={logoutPath} />
      </div>
    </aside>
  );
}
