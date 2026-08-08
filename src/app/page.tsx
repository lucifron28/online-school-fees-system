'use client';

import React from 'react';
import Link from 'next/link';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Shield,
  Users,
  GraduationCap,
  LayoutDashboard,
  CreditCard,
  Receipt,
  FileText,
  Wallet,
  ArrowRight,
  Monitor,
  CheckCircle2,
  Building2,
  ExternalLink,
} from 'lucide-react';

export default function HomeHubPage() {
  const categories = [
    {
      role: 'Authentication & Logins',
      color: 'bg-slate-900 text-white',
      badgeColor: 'bg-slate-100 text-slate-800 border-slate-200',
      icon: Monitor,
      items: [
        {
          num: 1,
          title: 'ADMIN LOGIN',
          desc: 'Split-screen admin login with campus building illustration placeholder',
          href: '/login/admin',
          icon: Shield,
        },
        {
          num: 9,
          title: 'PARENT LOGIN',
          desc: 'Split-screen parent login with family illustration placeholder',
          href: '/login/parent',
          icon: Users,
        },
        {
          num: 15,
          title: 'STUDENT LOGIN',
          desc: 'Split-screen student login with student character illustration placeholder',
          href: '/login/student',
          icon: GraduationCap,
        },
      ],
    },
    {
      role: 'Admin & Finance Portal',
      color: 'bg-blue-600 text-white',
      badgeColor: 'bg-blue-50 text-blue-700 border-blue-200',
      icon: Shield,
      items: [
        {
          num: 2,
          title: 'ADMIN DASHBOARD',
          desc: 'Metrics summary, collection line chart, and recent transactions',
          href: '/admin/dashboard',
          icon: LayoutDashboard,
        },
        {
          num: 3,
          title: 'ADMIN STUDENT LIST',
          desc: 'Directory table, grade filter, search, and Add Student modal',
          href: '/admin/students',
          icon: Users,
        },
        {
          num: 4,
          title: 'ADMIN FEES MANAGEMENT',
          desc: 'Fee structure template list, applicability rules, and creation form',
          href: '/admin/fees',
          icon: CreditCard,
        },
        {
          num: 5,
          title: 'ADMIN MAKE PAYMENT (MANUAL)',
          desc: 'Over-The-Counter cashier payment processing form and balance breakdown',
          href: '/admin/payments/manual',
          icon: Wallet,
        },
        {
          num: 6,
          title: 'ADMIN TRANSACTIONS',
          desc: 'Financial transactions log with date range and payment method filters',
          href: '/admin/transactions',
          icon: Receipt,
        },
        {
          num: 7,
          title: 'ADMIN REPORTS',
          desc: 'Grid of institutional financial reports with PDF/CSV export actions',
          href: '/admin/reports',
          icon: FileText,
        },
        {
          num: 8,
          title: 'ADMIN STUDENT PROFILE',
          desc: 'Select a persisted student to view the profile, assessment, and payment history',
          href: '/admin/students',
          icon: Users,
        },
        {
          num: 20,
          title: 'LAST TRANSACTION DETAILS',
          desc: 'Select a persisted transaction to view details and print its acknowledgment',
          href: '/admin/transactions',
          icon: Receipt,
        },
      ],
    },
    {
      role: 'Parent Portal',
      color: 'bg-emerald-600 text-white',
      badgeColor: 'bg-emerald-50 text-emerald-700 border-emerald-200',
      icon: Users,
      items: [
        {
          num: 10,
          title: 'PARENT DASHBOARD',
          desc: 'Outstanding balance highlight, total paid metrics, and children list',
          href: '/parent/dashboard',
          icon: LayoutDashboard,
        },
        {
          num: 11,
          title: 'CHILD ACCOUNT DETAILS',
          desc: 'Select a linked child to view itemized fees, payments, and balance status',
          href: '/parent/dashboard',
          icon: Users,
        },
        {
          num: 12,
          title: 'MAKE PAYMENT (ONLINE)',
          desc: 'Simulated digital payment gateway selection (GCash, Maya, Card)',
          href: '/parent/pay',
          icon: CreditCard,
        },
        {
          num: 13,
          title: 'PARENT PAYMENT RECEIPT',
          desc: 'Select a persisted acknowledgment receipt from payment history',
          href: '/parent/history',
          icon: Receipt,
        },
        {
          num: 14,
          title: 'PARENT PAYMENT HISTORY',
          desc: 'Full history of completed online and over-the-counter payments',
          href: '/parent/history',
          icon: Receipt,
        },
      ],
    },
    {
      role: 'Student Portal',
      color: 'bg-purple-600 text-white',
      badgeColor: 'bg-purple-50 text-purple-700 border-purple-200',
      icon: GraduationCap,
      items: [
        {
          num: 16,
          title: 'STUDENT DASHBOARD',
          desc: 'Student welcome card, outstanding balance highlight, and quick link',
          href: '/student/dashboard',
          icon: LayoutDashboard,
        },
        {
          num: 17,
          title: 'STUDENT ACCOUNT DETAILS',
          desc: 'Detailed fee assessment list and current balance statement',
          href: '/student/account',
          icon: GraduationCap,
        },
        {
          num: 18,
          title: 'STUDENT PAYMENT HISTORY',
          desc: 'Personal payment transaction history table',
          href: '/student/history',
          icon: Receipt,
        },
        {
          num: 19,
          title: 'STUDENT PAYMENT RECEIPT',
          desc: 'Select a persisted acknowledgment receipt from payment history',
          href: '/student/history',
          icon: Receipt,
        },
      ],
    },
  ];

  return (
    <div className="mx-auto max-w-7xl space-y-8 px-4 py-8 sm:px-6 lg:px-8">
      {/* Top Banner */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-slate-900 via-blue-950 to-slate-900 p-8 text-white shadow-xl">
        <div className="relative z-10 max-w-3xl space-y-4">
          <div className="flex items-center space-x-2">
            <span className="inline-flex items-center rounded-full border border-blue-400/30 bg-blue-500/20 px-3 py-1 font-mono text-xs font-semibold text-blue-300">
              <CheckCircle2 className="mr-1.5 h-3.5 w-3.5 text-blue-400" />
              20 / 20 Reference Screens Scaffolded
            </span>
          </div>

          <h1 className="text-3xl font-extrabold tracking-tight sm:text-4xl">
            Online School Fees Monitoring & Payment System
          </h1>

          <p className="text-sm leading-relaxed text-slate-300">
            Full UI scaffold matching the 20-screen reference architecture guide. Includes
            role-based layouts, dark mode sidebar, image placeholders, itemized fee tables, cashier
            payment workflows, and digital receipt generation.
          </p>

          <div className="flex flex-wrap items-center gap-3 pt-2">
            <Link href="/login/admin">
              <Button className="h-9 bg-blue-600 text-xs font-semibold text-white hover:bg-blue-500">
                <span>Start Demo (Admin Login)</span>
                <ArrowRight className="ml-1.5 h-4 w-4" />
              </Button>
            </Link>
            <Link href="/admin/dashboard">
              <Button
                variant="outline"
                className="h-9 border-slate-700 bg-slate-800/80 text-xs text-white hover:bg-slate-700"
              >
                <span>Direct to Admin Dashboard</span>
              </Button>
            </Link>
          </div>
        </div>
      </div>

      {/* Screen Categories Grid */}
      <div className="space-y-10">
        {categories.map((cat) => {
          const CatIcon = cat.icon;
          return (
            <div key={cat.role} className="space-y-4">
              <div className="flex items-center space-x-3 border-b border-slate-200 pb-3 dark:border-slate-800">
                <div className={`rounded-lg p-2 ${cat.color}`}>
                  <CatIcon className="h-5 w-5" />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">
                    {cat.role}
                  </h2>
                  <p className="text-xs text-slate-500">{cat.items.length} Screens</p>
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {cat.items.map((screen) => {
                  const Icon = screen.icon;
                  return (
                    <Card
                      key={screen.num}
                      className="group flex flex-col justify-between border-slate-200 shadow-sm transition-all hover:border-blue-300 hover:shadow-md dark:border-slate-800"
                    >
                      <CardHeader className="p-4 pb-2">
                        <div className="mb-2 flex items-center justify-between">
                          <span className="font-mono text-xs font-bold text-slate-500 transition-colors group-hover:text-blue-600">
                            Screen #{screen.num}
                          </span>
                          <div className="rounded-md bg-slate-100 p-1.5 text-slate-600 transition-colors group-hover:bg-blue-50 group-hover:text-blue-600 dark:bg-slate-800 dark:text-slate-300">
                            <Icon className="h-4 w-4" />
                          </div>
                        </div>
                        <CardTitle className="text-sm font-bold leading-tight text-slate-900 dark:text-slate-100">
                          {screen.title}
                        </CardTitle>
                        <CardDescription className="mt-1 line-clamp-2 text-xs text-slate-500">
                          {screen.desc}
                        </CardDescription>
                      </CardHeader>

                      <CardContent className="p-4 pt-2">
                        <Link href={screen.href}>
                          <Button
                            variant="outline"
                            className="h-8 w-full justify-between text-xs font-medium transition-colors group-hover:border-blue-600 group-hover:bg-blue-600 group-hover:text-white"
                          >
                            <span>Open View</span>
                            <ExternalLink className="h-3.5 w-3.5" />
                          </Button>
                        </Link>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
