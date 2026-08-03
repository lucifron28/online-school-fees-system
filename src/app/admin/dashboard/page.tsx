'use me';
'use client';

import React from 'react';
import Link from 'next/link';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Users, DollarSign, AlertCircle, Receipt, TrendingUp, Plus, ArrowUpRight } from 'lucide-react';

export default function AdminDashboardPage() {
  const metrics = [
    { title: 'Total Students', value: '1,245', subtext: 'Active enrolled', icon: Users, color: 'text-blue-600 bg-blue-50 dark:bg-blue-950/50' },
    { title: 'Total Revenue', value: '₱1,245,000.00', subtext: 'This month', icon: DollarSign, color: 'text-emerald-600 bg-emerald-50 dark:bg-emerald-950/50' },
    { title: 'Outstanding Balance', value: '₱525,400.00', subtext: 'Pending collection', icon: AlertCircle, color: 'text-rose-600 bg-rose-50 dark:bg-rose-950/50' },
    { title: 'Total Transactions', value: '2,350', subtext: 'This month', icon: Receipt, color: 'text-purple-600 bg-purple-50 dark:bg-purple-950/50' },
  ];

  const recentTransactions = [
    { id: 'OR-2024-000123', student: 'Juan Dela Cruz', type: 'Tuition Fee - Grade 10', amount: '₱15,000.00', date: 'May 30, 2024', status: 'Completed' },
    { id: 'OR-2024-000122', student: 'Maria Santos', type: 'Miscellaneous Fee', amount: '₱2,000.00', date: 'May 30, 2024', status: 'Completed' },
    { id: 'OR-2024-000121', student: 'Pedro Reyes', type: 'Laboratory Fee', amount: '₱1,500.00', date: 'May 29, 2024', status: 'Completed' },
    { id: 'OR-2024-000120', student: 'Ana Garcia', type: 'Tuition Fee - Grade 8', amount: '₱12,000.00', date: 'May 29, 2024', status: 'Completed' },
  ];

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2">
            <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950 dark:text-blue-300">
              Screen #2 • ADMIN DASHBOARD
            </Badge>
          </div>
          <h2 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100 mt-1">
            Welcome back, Administrator!
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Here is what is happening in your school today
          </p>
        </div>

        <div className="flex items-center space-x-3">
          <Link href="/admin/payments/manual">
            <Button className="bg-blue-600 hover:bg-blue-700 text-white text-xs h-9 shadow-sm">
              <Plus className="h-4 w-4 mr-1.5" />
              <span>Make OTC Payment</span>
            </Button>
          </Link>
        </div>
      </div>

      {/* Metrics Row */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {metrics.map((m) => {
          const Icon = m.icon;
          return (
            <Card key={m.title} className="border-slate-200 shadow-sm dark:border-slate-800">
              <CardContent className="p-5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">{m.title}</span>
                  <div className={`p-2 rounded-xl ${m.color}`}>
                    <Icon className="h-4 w-4" />
                  </div>
                </div>
                <div className="mt-3">
                  <div className="text-2xl font-bold text-slate-900 dark:text-slate-100">{m.value}</div>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">{m.subtext}</p>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Charts & Activity Grid */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Collection Overview Chart Placeholder */}
        <Card className="lg:col-span-2 border-slate-200 shadow-sm dark:border-slate-800">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <div>
              <CardTitle className="text-base font-semibold text-slate-900 dark:text-slate-100">
                Collection Overview
              </CardTitle>
              <p className="text-xs text-slate-500 dark:text-slate-400">Monthly revenue breakdown for SY 2024–2025</p>
            </div>
            <div className="flex items-center space-x-1 text-xs font-medium text-emerald-600 bg-emerald-50 dark:bg-emerald-950/60 px-2.5 py-1 rounded-full border border-emerald-200 dark:border-emerald-800">
              <TrendingUp className="h-3.5 w-3.5 mr-1" />
              <span>+18.4% YoY</span>
            </div>
          </CardHeader>
          <CardContent className="pt-4">
            <div className="h-64 w-full rounded-xl bg-gradient-to-b from-blue-500/5 via-slate-50 to-white dark:from-blue-950/20 dark:via-slate-900 dark:to-slate-900/40 p-4 border border-slate-100 dark:border-slate-800 flex flex-col justify-between">
              {/* Visual Simulated Chart Bars/Line */}
              <div className="flex-1 flex items-end justify-between space-x-2 pt-6 pb-2 px-2">
                {[
                  { month: 'Jan', val: '40%' },
                  { month: 'Feb', val: '65%' },
                  { month: 'Mar', val: '50%' },
                  { month: 'Apr', val: '80%' },
                  { month: 'May', val: '95%' },
                  { month: 'Jun', val: '70%' },
                  { month: 'Jul', val: '60%' },
                  { month: 'Aug', val: '85%' },
                ].map((item) => (
                  <div key={item.month} className="flex flex-col items-center flex-1 space-y-2">
                    <div className="w-full max-w-[28px] rounded-t-md bg-blue-600/80 hover:bg-blue-600 transition-all shadow-sm" style={{ height: item.val }} />
                    <span className="text-[10px] text-slate-500 font-mono">{item.month}</span>
                  </div>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Recent Transactions List */}
        <Card className="border-slate-200 shadow-sm dark:border-slate-800">
          <CardHeader className="flex flex-row items-center justify-between pb-3">
            <CardTitle className="text-base font-semibold text-slate-900 dark:text-slate-100">
              Recent Transactions
            </CardTitle>
            <Link href="/admin/transactions" className="text-xs text-blue-600 hover:underline flex items-center font-medium">
              <span>View All</span>
              <ArrowUpRight className="h-3.5 w-3.5 ml-0.5" />
            </Link>
          </CardHeader>
          <CardContent className="p-0">
            <div className="divide-y divide-slate-100 dark:divide-slate-800">
              {recentTransactions.map((tx) => (
                <Link
                  key={tx.id}
                  href={`/admin/transactions/${tx.id}`}
                  className="flex items-center justify-between p-4 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors"
                >
                  <div>
                    <p className="text-xs font-semibold text-slate-900 dark:text-slate-100">{tx.student}</p>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400">{tx.type}</p>
                    <p className="text-[10px] text-slate-400 font-mono mt-0.5">{tx.id} • {tx.date}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs font-bold text-slate-900 dark:text-slate-100">{tx.amount}</p>
                    <Badge variant="outline" className="text-[10px] px-1.5 py-0 bg-emerald-50 text-emerald-700 border-emerald-200 mt-1">
                      {tx.status}
                    </Badge>
                  </div>
                </Link>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
