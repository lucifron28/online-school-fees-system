'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Bell, User } from 'lucide-react';
import { LogoutButton } from '@/components/auth/logout-button';

interface HeaderProps {
  title?: string;
  subtitle?: string;
  userName?: string;
  userRole?: string;
  logoutPath?: string;
  notificationsPath?: string;
}

const pageCopy = [
  { path: '/admin/dashboard', title: 'Dashboard', subtitle: 'A clear view of school collections and balances.' },
  { path: '/admin/students', title: 'Students', subtitle: 'Manage student records and account links.' },
  { path: '/admin/guardians', title: 'Guardians', subtitle: 'Keep family account relationships current.' },
  { path: '/admin/fees', title: 'Fees management', subtitle: 'Maintain assessment structures for the school year.' },
  { path: '/admin/payments', title: 'Payments', subtitle: 'Record and review over-the-counter payments.' },
  { path: '/admin/transactions', title: 'Transactions', subtitle: 'Review the school payment ledger.' },
  { path: '/admin/reports', title: 'Reports', subtitle: 'Export and reconcile financial activity.' },
  { path: '/admin/notifications', title: 'Notifications', subtitle: 'Review important account updates.' },
  { path: '/admin/users', title: 'Users', subtitle: 'Manage portal access and roles.' },
  { path: '/admin/settings', title: 'Settings', subtitle: 'Configure school finance preferences.' },
  { path: '/parent/dashboard', title: 'Dashboard', subtitle: 'Keep your children’s fee records in view.' },
  { path: '/parent/history', title: 'Payment history', subtitle: 'Review receipts and completed payments.' },
  { path: '/parent/pay', title: 'Make a payment', subtitle: 'Choose a payment method for an outstanding balance.' },
  { path: '/parent/notifications', title: 'Notifications', subtitle: 'Review updates about your account.' },
  { path: '/student/dashboard', title: 'Dashboard', subtitle: 'Keep your assessment and payment records close.' },
  { path: '/student/account', title: 'My account', subtitle: 'Review your current assessment and balance.' },
  { path: '/student/history', title: 'Payment history', subtitle: 'Review your completed payments and receipts.' },
  { path: '/student/notifications', title: 'Notifications', subtitle: 'Review updates about your account.' },
];

function getPageCopy(pathname: string, fallbackTitle: string, fallbackSubtitle?: string) {
  const match = pageCopy
    .slice()
    .sort((a, b) => b.path.length - a.path.length)
    .find((item) => pathname === item.path || pathname.startsWith(`${item.path}/`));

  return {
    title: match?.title ?? fallbackTitle,
    subtitle: match?.subtitle ?? fallbackSubtitle,
  };
}

export function Header({
  title = 'Dashboard',
  subtitle,
  userName = 'Administrator',
  userRole = 'Administrator',
  logoutPath = '/login/admin',
  notificationsPath = '/admin/notifications',
}: HeaderProps) {
  const pathname = usePathname();
  const copy = getPageCopy(pathname, title, subtitle);

  return (
    <header className="sticky top-0 z-30 hidden h-[4.5rem] w-full items-center justify-between border-b border-border bg-background/90 px-6 backdrop-blur-md lg:flex">
      <div className="min-w-0">
        <h1 className="truncate text-lg font-semibold tracking-tight text-foreground">{copy.title}</h1>
        {copy.subtitle && <p className="truncate text-xs text-muted-foreground">{copy.subtitle}</p>}
      </div>

      <div className="flex items-center gap-2">
        <Link
          href={notificationsPath}
          aria-label="Open notifications"
          className="flex h-11 w-11 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
        >
          <Bell className="h-5 w-5" aria-hidden="true" />
        </Link>

        <div className="flex items-center gap-3 border-l border-border pl-4">
          <div className="flex h-9 w-9 items-center justify-center rounded-full border border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-800 dark:bg-blue-950/60 dark:text-blue-300">
            <User className="h-4 w-4" aria-hidden="true" />
          </div>
          <div className="hidden text-left sm:block">
            <p className="max-w-40 truncate text-xs font-semibold leading-tight text-foreground">{userName}</p>
            <p className="text-[10px] text-muted-foreground">{userRole}</p>
          </div>
        </div>

        <LogoutButton
          logoutPath={logoutPath}
          className="ml-1 flex h-11 w-11 items-center justify-center rounded-lg p-0 text-muted-foreground hover:bg-accent hover:text-red-600"
        />
      </div>
    </header>
  );
}
