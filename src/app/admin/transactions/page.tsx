'use client';

import React from 'react';
import Link from 'next/link';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from '@/components/ui/table';
import { Search, Filter, Eye, Download, FileText } from 'lucide-react';

export default function AdminTransactionsPage() {
  const transactions = [
    {
      id: 'OR-2024-000123',
      date: 'May 30, 2024',
      student: 'Juan Dela Cruz',
      amount: '₱14,000.00',
      method: 'GCash',
      status: 'Completed',
    },
    {
      id: 'OR-2024-000122',
      date: 'May 30, 2024',
      student: 'Maria Santos',
      amount: '₱12,000.00',
      method: 'GCash',
      status: 'Completed',
    },
    {
      id: 'OR-2024-000121',
      date: 'May 29, 2024',
      student: 'Pedro Reyes',
      amount: '₱13,500.00',
      method: 'Cash',
      status: 'Completed',
    },
    {
      id: 'OR-2024-000120',
      date: 'May 29, 2024',
      student: 'Ana Garcia',
      amount: '₱12,000.00',
      method: 'Maya',
      status: 'Completed',
    },
    {
      id: 'OR-2024-000119',
      date: 'May 28, 2024',
      student: 'Liam Johnson',
      amount: '₱15,000.00',
      method: 'GCash',
      status: 'Completed',
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <Badge variant="outline" className="border-blue-200 bg-blue-50 text-blue-700">
            Screen #6 • ADMIN - TRANSACTIONS
          </Badge>
          <h2 className="mt-1 text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
            Financial Transactions Log
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Review and filter all over-the-counter and simulated online payments
          </p>
        </div>

        <Button variant="outline" className="h-9 text-xs">
          <Download className="mr-1.5 h-4 w-4" />
          <span>Export CSV</span>
        </Button>
      </div>

      <Card className="border-slate-200 shadow-sm dark:border-slate-800">
        <CardHeader className="pb-4">
          <div className="grid gap-3 sm:grid-cols-4">
            <div>
              <label className="mb-1 block text-[11px] font-semibold text-slate-500">
                Date From
              </label>
              <Input type="date" defaultValue="2024-05-01" className="h-9 text-xs" />
            </div>
            <div>
              <label className="mb-1 block text-[11px] font-semibold text-slate-500">Date To</label>
              <Input type="date" defaultValue="2024-05-31" className="h-9 text-xs" />
            </div>
            <div>
              <label className="mb-1 block text-[11px] font-semibold text-slate-500">
                Search Student / OR
              </label>
              <div className="relative">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-slate-400" />
                <Input placeholder="OR No. or Name..." className="h-9 pl-8 text-xs" />
              </div>
            </div>
            <div className="flex items-end">
              <Button className="h-9 w-full bg-blue-600 text-xs text-white hover:bg-blue-700">
                <Filter className="mr-1 h-3.5 w-3.5" />
                <span>Apply Filters</span>
              </Button>
            </div>
          </div>
        </CardHeader>

        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>OR No.</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Student Name</TableHead>
                <TableHead>Amount</TableHead>
                <TableHead>Payment Method</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {transactions.map((tx) => (
                <TableRow key={tx.id}>
                  <TableCell className="font-mono text-xs font-bold text-slate-900 dark:text-slate-100">
                    {tx.id}
                  </TableCell>
                  <TableCell className="text-xs text-slate-500">{tx.date}</TableCell>
                  <TableCell className="text-xs font-semibold text-slate-900 dark:text-slate-100">
                    {tx.student}
                  </TableCell>
                  <TableCell className="text-xs font-bold text-slate-900 dark:text-slate-100">
                    {tx.amount}
                  </TableCell>
                  <TableCell className="text-xs">
                    <span className="inline-flex items-center rounded bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-700 dark:bg-slate-800 dark:text-slate-300">
                      {tx.method}
                    </span>
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant="outline"
                      className="border-emerald-200 bg-emerald-50 text-[10px] text-emerald-700"
                    >
                      {tx.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <Link href={`/admin/transactions/${tx.id}`}>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 text-xs text-blue-600 hover:bg-blue-50 hover:text-blue-700"
                      >
                        <Eye className="mr-1 h-3.5 w-3.5" />
                        <span>View Details</span>
                      </Button>
                    </Link>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>

          {/* Pagination */}
          <div className="flex items-center justify-between border-t border-slate-100 px-4 py-3 text-xs text-slate-500 dark:border-slate-800">
            <span>Showing 1 to 5 of 2,350 transactions</span>
            <div className="flex items-center space-x-1">
              <Button variant="outline" size="sm" className="h-7 text-xs" disabled>
                Previous
              </Button>
              <Button variant="outline" size="sm" className="h-7 bg-blue-600 text-xs text-white">
                1
              </Button>
              <Button variant="outline" size="sm" className="h-7 text-xs">
                2
              </Button>
              <Button variant="outline" size="sm" className="h-7 text-xs">
                Next
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
