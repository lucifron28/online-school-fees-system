'use me';
'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import {
  LayoutDashboard,
  Users,
  CreditCard,
  Receipt,
  FileText,
  Settings,
  LogOut,
  UserCheck,
  Building2,
  ChevronRight,
  Shield,
  GraduationCap,
  History,
  BellRing,
  Wallet
} from 'lucide-react';

export type Role = 'admin' | 'parent' | 'student';

interface SidebarProps {
  role: Role;
}

export function Sidebar({ role }: SidebarProps) {
  const pathname = usePathname();

  const adminNav = [
    { name: 'Dashboard', href: '/admin/dashboard', icon: LayoutDashboard },
    { name: 'Students', href: '/admin/students', icon: Users },
    { name: 'Fees Management', href: '/admin/fees', icon: CreditCard },
    { name: 'Payments (OTC)', href: '/admin/payments/manual', icon: Wallet },
    { name: 'Transactions', href: '/admin/transactions', icon: Receipt },
    { name: 'Reports', href: '/admin/reports', icon: FileText },
    { name: 'Users', href: '/admin/users', icon: UserCheck },
    { name: 'Settings', href: '/admin/settings', icon: Settings },
  ];

  const parentNav = [
    { name: 'Dashboard', href: '/parent/dashboard', icon: LayoutDashboard },
    { name: 'My Children', href: '/parent/children/S2024-0001', icon: Users },
    { name: 'Payment History', href: '/parent/history', icon: History },
    { name: 'Make Payment', href: '/parent/pay', icon: CreditCard },
    { name: 'Announcements', href: '/parent/announcements', icon: BellRing },
    { name: 'Profile', href: '/parent/profile', icon: UserCheck },
    { name: 'Settings', href: '/parent/settings', icon: Settings },
  ];

  const studentNav = [
    { name: 'Dashboard', href: '/student/dashboard', icon: LayoutDashboard },
    { name: 'My Account', href: '/student/account', icon: GraduationCap },
    { name: 'Payment History', href: '/student/history', icon: History },
    { name: 'Announcements', href: '/student/announcements', icon: BellRing },
    { name: 'Profile', href: '/student/profile', icon: UserCheck },
  ];

  const navItems = role === 'admin' ? adminNav : role === 'parent' ? parentNav : studentNav;

  const roleTitle = role === 'admin' ? 'Administrator Portal' : role === 'parent' ? 'Parent Portal' : 'Student Portal';
  const roleBadge = role === 'admin' ? 'ADMIN' : role === 'parent' ? 'PARENT' : 'STUDENT';
  const roleColor = role === 'admin' ? 'bg-blue-600/20 text-blue-400 border-blue-500/30' : role === 'parent' ? 'bg-emerald-600/20 text-emerald-400 border-emerald-500/30' : 'bg-purple-600/20 text-purple-400 border-purple-500/30';

  return (
    <aside className="w-64 flex-shrink-0 bg-slate-900 text-slate-100 flex flex-col min-h-screen border-r border-slate-800 shadow-xl">
      {/* Brand Header */}
      <div className="p-4 border-b border-slate-800 flex items-center space-x-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-600 font-bold text-white shadow-md">
          <Building2 className="h-5 w-5" />
        </div>
        <div>
          <h2 className="text-sm font-semibold tracking-tight text-white">School Fees</h2>
          <span className={cn('inline-block text-[10px] font-mono px-2 py-0.5 rounded border mt-0.5 font-bold', roleColor)}>
            {roleBadge}
          </span>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
        <div className="px-3 py-2 text-xs font-semibold uppercase tracking-wider text-slate-400">
          Navigation
        </div>
        {navItems.map((item) => {
          const isActive = pathname === item.href || (item.href !== `/${role}/dashboard` && pathname.startsWith(item.href));
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'flex items-center justify-between px-3.5 py-2.5 rounded-lg text-sm font-medium transition-all group',
                isActive
                  ? 'bg-blue-600 text-white shadow-md font-semibold'
                  : 'text-slate-300 hover:bg-slate-800/80 hover:text-white'
              )}
            >
              <div className="flex items-center space-x-3">
                <Icon className={cn('h-4 w-4', isActive ? 'text-white' : 'text-slate-400 group-hover:text-white')} />
                <span>{item.name}</span>
              </div>
              {isActive && <ChevronRight className="h-4 w-4 text-white/80" />}
            </Link>
          );
        })}
      </nav>

      {/* Footer User Info & Logout */}
      <div className="p-3 border-t border-slate-800 space-y-2">
        <div className="flex items-center justify-between px-3 py-2 rounded-lg bg-slate-800/50 text-xs">
          <div className="flex items-center space-x-2">
            <div className="h-7 w-7 rounded-full bg-slate-700 flex items-center justify-center font-bold text-slate-200">
              {role === 'admin' ? 'A' : role === 'parent' ? 'P' : 'S'}
            </div>
            <div>
              <p className="font-medium text-slate-200 truncate max-w-[110px]">
                {role === 'admin' ? 'Administrator' : role === 'parent' ? 'Juan Dela Cruz Sr.' : 'Juan Dela Cruz Jr.'}
              </p>
              <p className="text-[10px] text-slate-400 capitalize">{role}</p>
            </div>
          </div>
        </div>

        <Link
          href={`/login/${role}`}
          className="flex items-center space-x-3 px-3.5 py-2 rounded-lg text-sm text-slate-400 hover:bg-red-950/40 hover:text-red-400 transition-colors"
        >
          <LogOut className="h-4 w-4" />
          <span>Logout</span>
        </Link>
      </div>
    </aside>
  );
}
