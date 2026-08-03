'use me';
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
  ExternalLink
} from 'lucide-react';

export default function HomeHubPage() {
  const categories = [
    {
      role: 'Authentication & Logins',
      color: 'bg-slate-900 text-white',
      badgeColor: 'bg-slate-100 text-slate-800 border-slate-200',
      icon: Monitor,
      items: [
        { num: 1, title: 'ADMIN LOGIN', desc: 'Split-screen admin login with campus building illustration placeholder', href: '/login/admin', icon: Shield },
        { num: 9, title: 'PARENT LOGIN', desc: 'Split-screen parent login with family illustration placeholder', href: '/login/parent', icon: Users },
        { num: 15, title: 'STUDENT LOGIN', desc: 'Split-screen student login with student character illustration placeholder', href: '/login/student', icon: GraduationCap },
      ],
    },
    {
      role: 'Admin & Finance Portal',
      color: 'bg-blue-600 text-white',
      badgeColor: 'bg-blue-50 text-blue-700 border-blue-200',
      icon: Shield,
      items: [
        { num: 2, title: 'ADMIN DASHBOARD', desc: 'Metrics summary, collection line chart, and recent transactions', href: '/admin/dashboard', icon: LayoutDashboard },
        { num: 3, title: 'ADMIN STUDENT LIST', desc: 'Directory table, grade filter, search, and Add Student modal', href: '/admin/students', icon: Users },
        { num: 4, title: 'ADMIN FEES MANAGEMENT', desc: 'Fee structure template list, applicability rules, and creation form', href: '/admin/fees', icon: CreditCard },
        { num: 5, title: 'ADMIN MAKE PAYMENT (MANUAL)', desc: 'Over-The-Counter cashier payment processing form and balance breakdown', href: '/admin/payments/manual', icon: Wallet },
        { num: 6, title: 'ADMIN TRANSACTIONS', desc: 'Financial transactions log with date range and payment method filters', href: '/admin/transactions', icon: Receipt },
        { num: 7, title: 'ADMIN REPORTS', desc: 'Grid of institutional financial reports with PDF/CSV export actions', href: '/admin/reports', icon: FileText },
        { num: 8, title: 'ADMIN STUDENT PROFILE', desc: 'Student profile header, fee assessment breakdown, and payment history', href: '/admin/students/S2024-0001', icon: Users },
        { num: 20, title: 'LAST TRANSACTION DETAILS', desc: 'Detailed view of completed transaction OR-2024-000123 with print option', href: '/admin/transactions/OR-2024-000123', icon: Receipt },
      ],
    },
    {
      role: 'Parent Portal',
      color: 'bg-emerald-600 text-white',
      badgeColor: 'bg-emerald-50 text-emerald-700 border-emerald-200',
      icon: Users,
      items: [
        { num: 10, title: 'PARENT DASHBOARD', desc: 'Outstanding balance highlight, total paid metrics, and children list', href: '/parent/dashboard', icon: LayoutDashboard },
        { num: 11, title: 'CHILD ACCOUNT DETAILS', desc: 'Itemized fee breakdown, paid vs. balance breakdown, and status badges', href: '/parent/children/S2024-0001', icon: Users },
        { num: 12, title: 'MAKE PAYMENT (ONLINE)', desc: 'Simulated digital payment gateway selection (GCash, Maya, Card)', href: '/parent/pay', icon: CreditCard },
        { num: 13, title: 'PARENT PAYMENT RECEIPT', desc: 'Official digital receipt view with itemized charges and download action', href: '/parent/receipts/OR-2024-000123', icon: Receipt },
        { num: 14, title: 'PARENT PAYMENT HISTORY', desc: 'Full history of completed online and over-the-counter payments', href: '/parent/history', icon: Receipt },
      ],
    },
    {
      role: 'Student Portal',
      color: 'bg-purple-600 text-white',
      badgeColor: 'bg-purple-50 text-purple-700 border-purple-200',
      icon: GraduationCap,
      items: [
        { num: 16, title: 'STUDENT DASHBOARD', desc: 'Student welcome card, outstanding balance highlight, and quick link', href: '/student/dashboard', icon: LayoutDashboard },
        { num: 17, title: 'STUDENT ACCOUNT DETAILS', desc: 'Detailed fee assessment list and current balance statement', href: '/student/account', icon: GraduationCap },
        { num: 18, title: 'STUDENT PAYMENT HISTORY', desc: 'Personal payment transaction history table', href: '/student/history', icon: Receipt },
        { num: 19, title: 'STUDENT PAYMENT RECEIPT', desc: 'Digital receipt viewer for completed payments', href: '/student/receipts/OR-2024-000123', icon: Receipt },
      ],
    },
  ];

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8 space-y-8">
      {/* Top Banner */}
      <div className="rounded-2xl bg-gradient-to-r from-slate-900 via-blue-950 to-slate-900 p-8 text-white shadow-xl relative overflow-hidden">
        <div className="relative z-10 space-y-4 max-w-3xl">
          <div className="flex items-center space-x-2">
            <span className="inline-flex items-center rounded-full bg-blue-500/20 px-3 py-1 text-xs font-mono font-semibold text-blue-300 border border-blue-400/30">
              <CheckCircle2 className="h-3.5 w-3.5 mr-1.5 text-blue-400" />
              20 / 20 Reference Screens Scaffolded
            </span>
          </div>

          <h1 className="text-3xl font-extrabold tracking-tight sm:text-4xl">
            Online School Fees Monitoring & Payment System
          </h1>

          <p className="text-sm text-slate-300 leading-relaxed">
            Full UI scaffold matching the 20-screen reference architecture guide. Includes role-based layouts, dark mode sidebar, image placeholders, itemized fee tables, cashier payment workflows, and digital receipt generation.
          </p>

          <div className="pt-2 flex flex-wrap items-center gap-3">
            <Link href="/login/admin">
              <Button className="bg-blue-600 hover:bg-blue-500 text-white text-xs h-9 font-semibold">
                <span>Start Demo (Admin Login)</span>
                <ArrowRight className="h-4 w-4 ml-1.5" />
              </Button>
            </Link>
            <Link href="/admin/dashboard">
              <Button variant="outline" className="border-slate-700 bg-slate-800/80 text-white hover:bg-slate-700 text-xs h-9">
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
              <div className="flex items-center space-x-3 border-b border-slate-200 dark:border-slate-800 pb-3">
                <div className={`p-2 rounded-lg ${cat.color}`}>
                  <CatIcon className="h-5 w-5" />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">{cat.role}</h2>
                  <p className="text-xs text-slate-500">{cat.items.length} Screens</p>
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {cat.items.map((screen) => {
                  const Icon = screen.icon;
                  return (
                    <Card
                      key={screen.num}
                      className="border-slate-200 dark:border-slate-800 shadow-sm hover:shadow-md hover:border-blue-300 transition-all flex flex-col justify-between group"
                    >
                      <CardHeader className="p-4 pb-2">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-xs font-mono font-bold text-slate-500 group-hover:text-blue-600 transition-colors">
                            Screen #{screen.num}
                          </span>
                          <div className="p-1.5 rounded-md bg-slate-100 dark:bg-slate-800 group-hover:bg-blue-50 text-slate-600 dark:text-slate-300 group-hover:text-blue-600 transition-colors">
                            <Icon className="h-4 w-4" />
                          </div>
                        </div>
                        <CardTitle className="text-sm font-bold text-slate-900 dark:text-slate-100 leading-tight">
                          {screen.title}
                        </CardTitle>
                        <CardDescription className="text-xs text-slate-500 line-clamp-2 mt-1">
                          {screen.desc}
                        </CardDescription>
                      </CardHeader>

                      <CardContent className="p-4 pt-2">
                        <Link href={screen.href}>
                          <Button
                            variant="outline"
                            className="w-full text-xs h-8 justify-between font-medium group-hover:bg-blue-600 group-hover:text-white group-hover:border-blue-600 transition-colors"
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
