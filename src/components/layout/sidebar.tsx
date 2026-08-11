'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import { LogoutButton } from '@/components/auth/logout-button';
import {
  BellRing,
  Building2,
  ClipboardCheck,
  ChevronRight,
  CreditCard,
  FileText,
  GraduationCap,
  History,
  LayoutDashboard,
  Megaphone,
  Menu,
  Receipt,
  Settings,
  Shield,
  UserCheck,
  Users,
  Wallet,
  X,
} from 'lucide-react';

export type Role = 'admin' | 'finance' | 'parent' | 'student';

interface SidebarProps {
  role: Role;
  userName?: string;
  logoutPath?: string;
}

type NavItem = {
  name: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
};

function NavigationLinks({
  items,
  pathname,
  portalPath,
  onNavigate,
}: {
  items: NavItem[];
  pathname: string;
  portalPath: string;
  onNavigate?: () => void;
}) {
  return (
    <nav className="flex-1 space-y-1 overflow-y-auto p-3" aria-label="Portal navigation">
      <div className="px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
        Navigation
      </div>
      {items.map((item) => {
        const isDashboard = item.href === `${portalPath}/dashboard` && item.name === 'Dashboard';
        const isActive = isDashboard
          ? pathname === item.href
          : item.href !== `${portalPath}/dashboard` && pathname.startsWith(item.href);
        const Icon = item.icon;

        return (
          <Link
            key={`${item.name}-${item.href}`}
            href={item.href}
            onClick={onNavigate}
            className={cn(
              'group flex min-h-11 items-center justify-between rounded-lg px-3.5 text-sm font-medium transition-colors duration-150',
              isActive
                ? 'bg-blue-600 text-white shadow-sm'
                : 'text-slate-300 hover:bg-slate-800 hover:text-white'
            )}
            aria-current={isActive ? 'page' : undefined}
          >
            <span className="flex items-center gap-3">
              <Icon
                className={cn(
                  'h-4 w-4 shrink-0',
                  isActive ? 'text-white' : 'text-slate-500 group-hover:text-slate-200'
                )}
                aria-hidden="true"
              />
              <span>{item.name}</span>
            </span>
            {isActive && <ChevronRight className="h-4 w-4 text-white/80" aria-hidden="true" />}
          </Link>
        );
      })}
    </nav>
  );
}

export function Sidebar({
  role,
  userName = 'Authenticated user',
  logoutPath = '/login/admin',
}: SidebarProps) {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!mobileOpen) return;

    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setMobileOpen(false);
    };

    window.addEventListener('keydown', closeOnEscape);
    return () => window.removeEventListener('keydown', closeOnEscape);
  }, [mobileOpen]);

  const adminNav: NavItem[] = [
    { name: 'Dashboard', href: '/admin/dashboard', icon: LayoutDashboard },
    { name: 'Students', href: '/admin/students', icon: Users },
    { name: 'Guardians', href: '/admin/guardians', icon: UserCheck },
    { name: 'Fees Management', href: '/admin/fees', icon: CreditCard },
    { name: 'Payments (OTC)', href: '/admin/payments/manual', icon: Wallet },
    { name: 'Payment Proofs', href: '/admin/payment-submissions', icon: ClipboardCheck },
    { name: 'Transactions', href: '/admin/transactions', icon: Receipt },
    { name: 'Reports', href: '/admin/reports', icon: FileText },
    { name: 'Notifications', href: '/admin/notifications', icon: BellRing },
    { name: 'Announcements', href: '/admin/announcements', icon: Megaphone },
    { name: 'Users', href: '/admin/users', icon: UserCheck },
    { name: 'Settings', href: '/admin/settings', icon: Settings },
  ];

  const parentNav: NavItem[] = [
    { name: 'Dashboard', href: '/parent/dashboard', icon: LayoutDashboard },
    { name: 'My Children', href: '/parent/dashboard', icon: Users },
    { name: 'Payment History', href: '/parent/history', icon: History },
    { name: 'Payment Proofs', href: '/parent/payment-submissions', icon: ClipboardCheck },
    { name: 'Make Payment', href: '/parent/pay', icon: CreditCard },
    { name: 'Notifications', href: '/parent/notifications', icon: BellRing },
    { name: 'Announcements', href: '/parent/announcements', icon: Megaphone },
  ];

  const studentNav: NavItem[] = [
    { name: 'Dashboard', href: '/student/dashboard', icon: LayoutDashboard },
    { name: 'My Account', href: '/student/account', icon: GraduationCap },
    { name: 'Payment History', href: '/student/history', icon: History },
    { name: 'Notifications', href: '/student/notifications', icon: BellRing },
    { name: 'Announcements', href: '/student/announcements', icon: Megaphone },
  ];

  const navItems =
    role === 'admin'
      ? adminNav
      : role === 'finance'
        ? adminNav.filter((item) => !['Users', 'Settings'].includes(item.name))
        : role === 'parent'
          ? parentNav
          : studentNav;

  const portalPath = role === 'parent' ? '/parent' : role === 'student' ? '/student' : '/admin';
  const roleTitle =
    role === 'admin'
      ? 'Administrator Portal'
      : role === 'finance'
        ? 'Finance Staff Portal'
        : role === 'parent'
          ? 'Parent Portal'
          : 'Student Portal';
  const roleBadge =
    role === 'admin'
      ? 'ADMIN'
      : role === 'finance'
        ? 'FINANCE STAFF'
        : role === 'parent'
          ? 'PARENT'
          : 'STUDENT';
  const roleColor =
    role === 'parent'
      ? 'border-teal-400/30 bg-teal-500/15 text-teal-200'
      : role === 'student'
        ? 'border-sky-400/30 bg-sky-500/15 text-sky-200'
        : 'border-blue-400/30 bg-blue-500/15 text-blue-200';
  const initials =
    role === 'admin' ? 'A' : role === 'finance' ? 'F' : role === 'parent' ? 'P' : 'S';

  const brand = (
    <Link href={portalPath} className="flex items-center gap-3 rounded-lg" aria-label={roleTitle}>
      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-600 text-white shadow-sm">
        <Building2 className="h-5 w-5" aria-hidden="true" />
      </div>
      <div>
        <span className="block text-sm font-semibold tracking-tight text-white">School Fees</span>
        <span
          className={cn(
            'mt-1 inline-flex rounded-full border px-2 py-0.5 text-[10px] font-bold',
            roleColor
          )}
        >
          {roleBadge}
        </span>
      </div>
    </Link>
  );

  const userBlock = (
    <div className="space-y-2 border-t border-slate-800 p-3">
      <div className="flex items-center gap-2 rounded-lg bg-slate-800/60 px-3 py-2.5">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-slate-700 text-xs font-bold text-slate-100">
          {initials}
        </div>
        <div className="min-w-0">
          <p className="truncate text-xs font-medium text-slate-200">{userName}</p>
          <p className="truncate text-[10px] text-slate-400">{roleTitle}</p>
        </div>
      </div>
      <LogoutButton
        logoutPath={logoutPath}
        className="min-h-11 w-full justify-start rounded-lg px-3.5 text-slate-400 hover:bg-red-950/40 hover:text-red-300"
      />
    </div>
  );

  return (
    <>
      <div className="flex items-center justify-between border-b border-border bg-slate-950 px-4 py-3 text-slate-100 lg:hidden">
        {brand}
        <button
          type="button"
          className="flex h-11 w-11 items-center justify-center rounded-lg text-slate-300 hover:bg-slate-800 hover:text-white"
          aria-label="Open portal navigation"
          aria-expanded={mobileOpen}
          aria-controls="mobile-navigation"
          onClick={() => setMobileOpen(true)}
        >
          <Menu className="h-5 w-5" aria-hidden="true" />
        </button>
      </div>

      <aside className="hidden min-h-[100dvh] w-64 shrink-0 flex-col border-r border-slate-800 bg-slate-950 text-slate-100 lg:flex">
        <div className="border-b border-slate-800 p-4">{brand}</div>
        <NavigationLinks items={navItems} pathname={pathname} portalPath={portalPath} />
        {userBlock}
      </aside>

      {mobileOpen && (
        <>
          <button
            type="button"
            className="fixed inset-0 z-40 bg-slate-950/70 lg:hidden"
            aria-label="Close portal navigation"
            onClick={() => setMobileOpen(false)}
          />
          <aside
            id="mobile-navigation"
            className="fixed inset-y-0 left-0 z-50 flex w-[min(18rem,calc(100vw-2rem))] flex-col bg-slate-950 text-slate-100 shadow-2xl lg:hidden"
            aria-label="Mobile portal navigation"
          >
            <div className="flex items-center justify-between border-b border-slate-800 p-4">
              {brand}
              <button
                type="button"
                className="flex h-11 w-11 items-center justify-center rounded-lg text-slate-300 hover:bg-slate-800 hover:text-white"
                aria-label="Close portal navigation"
                onClick={() => setMobileOpen(false)}
              >
                <X className="h-5 w-5" aria-hidden="true" />
              </button>
            </div>
            <NavigationLinks
              items={navItems}
              pathname={pathname}
              portalPath={portalPath}
              onNavigate={() => setMobileOpen(false)}
            />
            {userBlock}
          </aside>
        </>
      )}
    </>
  );
}
