'use client';

import React from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  FileText,
  TrendingUp,
  AlertCircle,
  Receipt,
  PieChart,
  BarChart3,
  Download,
} from 'lucide-react';

export default function AdminReportsPage() {
  const reports = [
    {
      title: 'Collection Report',
      desc: 'Daily, weekly, and monthly fee collection totals with payment channel breakdowns',
      icon: TrendingUp,
      color: 'text-blue-600 bg-blue-50',
    },
    {
      title: 'Outstanding Balance Report',
      desc: 'Detailed listing of active unpaid and partial balances grouped by grade & section',
      icon: AlertCircle,
      color: 'text-rose-600 bg-rose-50',
    },
    {
      title: 'Transaction Report',
      desc: 'Complete audited log of all processed OTC cash and simulated online payments',
      icon: Receipt,
      color: 'text-emerald-600 bg-emerald-50',
    },
    {
      title: 'Student Ledger Report',
      desc: 'Historical debit/credit activity log across all enrolled students',
      icon: FileText,
      color: 'text-purple-600 bg-purple-50',
    },
    {
      title: 'Fee Summary Report',
      desc: 'Aggregated revenue totals itemized per fee category (Tuition, Misc, Lab)',
      icon: PieChart,
      color: 'text-amber-600 bg-amber-50',
    },
    {
      title: 'Payment Summary Report',
      desc: 'Comparative channel performance analysis (Cash vs. GCash vs. Maya)',
      icon: BarChart3,
      color: 'text-indigo-600 bg-indigo-50',
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <Badge variant="outline" className="border-blue-200 bg-blue-50 text-blue-700">
          Screen #7 • ADMIN - REPORTS
        </Badge>
        <h2 className="mt-1 text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
          Financial Reports & Statements
        </h2>
        <p className="text-xs text-slate-500 dark:text-slate-400">
          Generate, preview, and download official institutional financial summary reports
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {reports.map((r) => {
          const Icon = r.icon;
          return (
            <Card
              key={r.title}
              className="flex flex-col justify-between border-slate-200 shadow-sm transition-shadow hover:shadow-md dark:border-slate-800"
            >
              <CardHeader>
                <div className="mb-2 flex items-center space-x-3">
                  <div className={`rounded-xl p-2.5 ${r.color}`}>
                    <Icon className="h-5 w-5" />
                  </div>
                  <CardTitle className="text-base font-semibold">{r.title}</CardTitle>
                </div>
                <CardDescription className="text-xs">{r.desc}</CardDescription>
              </CardHeader>

              <CardContent className="pt-0">
                <Button
                  variant="outline"
                  className="h-9 w-full justify-center border-slate-200 text-xs"
                >
                  <Download className="mr-1.5 h-3.5 w-3.5" />
                  <span>Generate Report (PDF / CSV)</span>
                </Button>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
