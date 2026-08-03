'use me';
'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LayoutGrid, ChevronDown, Monitor, Shield, Users, GraduationCap, ArrowRight } from 'lucide-react';
import { cn } from '@/lib/utils';

export function DevRoleSwitcher() {
  const pathname = usePathname();
  const [isOpen, setIsOpen] = useState(false);

  const screens = [
    { num: 1, label: '1. Admin Login', href: '/login/admin', group: 'Login' },
    { num: 2, label: '2. Admin Dashboard', href: '/admin/dashboard', group: 'Admin' },
    { num: 3, label: '3. Admin Student List', href: '/admin/students', group: 'Admin' },
    { num: 4, label: '4. Admin Fees Management', href: '/admin/fees', group: 'Admin' },
    { num: 5, label: '5. Admin Make Payment (Manual)', href: '/admin/payments/manual', group: 'Admin' },
    { num: 6, label: '6. Admin Transactions', href: '/admin/transactions', group: 'Admin' },
    { num: 7, label: '7. Admin Reports', href: '/admin/reports', group: 'Admin' },
    { num: 8, label: '8. Admin Student Profile', href: '/admin/students/S2024-0001', group: 'Admin' },
    { num: 9, label: '9. Parent Login', href: '/login/parent', group: 'Login' },
    { num: 10, label: '10. Parent Dashboard', href: '/parent/dashboard', group: 'Parent' },
    { num: 11, label: '11. Parent Child Account Details', href: '/parent/children/S2024-0001', group: 'Parent' },
    { num: 12, label: '12. Parent Make Payment (Online)', href: '/parent/pay', group: 'Parent' },
    { num: 13, label: '13. Parent Payment Receipt', href: '/parent/receipts/OR-2024-000123', group: 'Parent' },
    { num: 14, label: '14. Parent Payment History', href: '/parent/history', group: 'Parent' },
    { num: 15, label: '15. Student Login', href: '/login/student', group: 'Login' },
    { num: 16, label: '16. Student Dashboard', href: '/student/dashboard', group: 'Student' },
    { num: 17, label: '17. Student Account Details', href: '/student/account', group: 'Student' },
    { num: 18, label: '18. Student Payment History', href: '/student/history', group: 'Student' },
    { num: 19, label: '19. Student Payment Receipt', href: '/student/receipts/OR-2024-000123', group: 'Student' },
    { num: 20, label: '20. Admin Transaction Details', href: '/admin/transactions/OR-2024-000123', group: 'Admin' },
  ];

  const activeScreen = screens.find((s) => s.href === pathname) || {
    num: 'Hub',
    label: 'Navigation Overview',
    href: '/',
  };

  return (
    <div className="bg-slate-950 text-white text-xs border-b border-slate-800 sticky top-0 z-50 shadow-lg">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-2">
        <div className="flex items-center space-x-3">
          <Link
            href="/"
            className="flex items-center space-x-1.5 font-bold text-blue-400 hover:text-blue-300 transition-colors bg-blue-950/60 border border-blue-800/60 px-2.5 py-1 rounded"
          >
            <LayoutGrid className="h-3.5 w-3.5" />
            <span>20 Screens Hub</span>
          </Link>
          <span className="text-slate-600">|</span>
          <div className="flex items-center space-x-2 text-slate-300">
            <span className="text-slate-400 font-mono">Screen:</span>
            <span className="font-semibold text-blue-300 bg-slate-900 px-2 py-0.5 rounded border border-slate-800">
              {activeScreen.label}
            </span>
          </div>
        </div>

        <div className="relative">
          <button
            onClick={() => setIsOpen(!isOpen)}
            className="flex items-center space-x-2 bg-slate-900 hover:bg-slate-800 text-slate-200 border border-slate-700 px-3 py-1 rounded font-medium transition-colors"
          >
            <Monitor className="h-3.5 w-3.5 text-blue-400" />
            <span>Quick Jump (20 Views)</span>
            <ChevronDown className={cn('h-3.5 w-3.5 transition-transform', isOpen && 'rotate-180')} />
          </button>

          {isOpen && (
            <div className="absolute right-0 mt-2 w-96 max-h-[80vh] overflow-y-auto rounded-xl bg-slate-900 border border-slate-800 shadow-2xl p-3 z-50 grid gap-2">
              <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider px-2 border-b border-slate-800 pb-1">
                Select Screen from Reference Image
              </div>
              <div className="grid grid-cols-1 gap-1">
                {screens.map((screen) => (
                  <Link
                    key={screen.num}
                    href={screen.href}
                    onClick={() => setIsOpen(false)}
                    className={cn(
                      'flex items-center justify-between px-2.5 py-1.5 rounded text-xs transition-colors',
                      pathname === screen.href
                        ? 'bg-blue-600 text-white font-bold'
                        : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                    )}
                  >
                    <span>{screen.label}</span>
                    <span className="text-[10px] opacity-70 font-mono bg-slate-950 px-1.5 py-0.5 rounded">
                      {screen.group}
                    </span>
                  </Link>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
