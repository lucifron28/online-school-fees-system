'use me';
'use client';

import React from 'react';
import Link from 'next/link';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table';
import { ImagePlaceholder } from '@/components/ui/image-placeholder';
import { ArrowLeft, Mail, Phone, MapPin, Calendar, CreditCard, Plus, Download } from 'lucide-react';

export default function AdminStudentProfilePage({ params }: { params: { id?: string } }) {
  const studentFees = [
    { year: '2024-2025', description: 'Tuition Fee (Full Year)', netFee: '₱12,000.00', paid: '₱12,000.00', balance: '₱0.00', status: 'Paid', date: 'June 20, 2024' },
    { year: '2024-2025', description: 'Tuition Fee (Full Year)', netFee: '₱15,000.00', paid: '₱10,000.00', balance: '₱5,000.00', status: 'Partial', date: 'June 20, 2024' },
    { year: '2024-2025', description: 'Miscellaneous Fee', netFee: '₱2,000.00', paid: '₱2,000.00', balance: '₱0.00', status: 'Paid', date: 'June 20, 2024' },
    { year: '2024-2025', description: 'Enrollment Fee', netFee: '₱2,500.00', paid: '₱2,500.00', balance: '₱0.00', status: 'Paid', date: 'June 18, 2024' },
  ];

  return (
    <div className="space-y-6">
      {/* Back Button & Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <Link href="/admin/students">
            <Button variant="outline" size="sm" className="h-9 px-3 text-xs">
              <ArrowLeft className="h-4 w-4 mr-1" />
              <span>Back to Students</span>
            </Button>
          </Link>
          <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">
            Screen #8 • ADMIN - STUDENT PROFILE
          </Badge>
        </div>

        <Link href="/admin/payments/manual">
          <Button className="bg-blue-600 hover:bg-blue-700 text-white text-xs h-9">
            <CreditCard className="h-4 w-4 mr-1.5" />
            <span>Process Payment for Student</span>
          </Button>
        </Link>
      </div>

      {/* Student Profile Info Card */}
      <Card className="border-slate-200 shadow-sm dark:border-slate-800">
        <CardContent className="p-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div className="flex items-center space-x-5">
              <ImagePlaceholder type="avatar" className="h-20 w-20 text-2xl font-bold border-2 border-blue-500" />
              <div>
                <div className="flex items-center space-x-2">
                  <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100">Juan Dela Cruz</h2>
                  <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200 text-xs">
                    Active
                  </Badge>
                </div>
                <p className="text-xs text-slate-500 font-mono mt-0.5">Student ID: 2024-0001 • Grade 10 - A</p>
                <div className="flex flex-wrap items-center gap-4 mt-3 text-xs text-slate-600 dark:text-slate-400">
                  <span className="flex items-center"><Calendar className="h-3.5 w-3.5 mr-1 text-slate-400" /> March 15, 2008</span>
                  <span className="flex items-center"><MapPin className="h-3.5 w-3.5 mr-1 text-slate-400" /> 123 Wilson St., Malabon, Quezon</span>
                  <span className="flex items-center"><Phone className="h-3.5 w-3.5 mr-1 text-slate-400" /> 09123456789</span>
                  <span className="flex items-center"><Mail className="h-3.5 w-3.5 mr-1 text-slate-400" /> juan.delacruz@gmail.com</span>
                </div>
              </div>
            </div>

            <div className="rounded-xl bg-blue-50 p-4 border border-blue-100 dark:bg-blue-950/40 dark:border-blue-900/40 min-w-[200px] text-right">
              <span className="text-xs font-medium text-slate-500 dark:text-slate-400">Total Outstanding Balance</span>
              <p className="text-2xl font-extrabold text-blue-700 dark:text-blue-300 mt-1">₱5,000.00</p>
              <span className="text-[10px] text-blue-600 font-medium">SY 2024–2025</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Tabs: Fees, Payments, Ledger */}
      <Tabs defaultValue="fees" className="w-full">
        <TabsList className="bg-white border border-slate-200 dark:border-slate-800 p-1">
          <TabsTrigger value="fees">Assessed Fees</TabsTrigger>
          <TabsTrigger value="payments">Payment History</TabsTrigger>
          <TabsTrigger value="ledger">Student Ledger</TabsTrigger>
        </TabsList>

        <TabsContent value="fees">
          <Card className="border-slate-200 shadow-sm dark:border-slate-800">
            <CardHeader className="flex flex-row items-center justify-between pb-3">
              <CardTitle className="text-base font-semibold">Assessed Fee Breakdown</CardTitle>
              <Button variant="outline" size="sm" className="h-8 text-xs">
                <Plus className="h-3.5 w-3.5 mr-1" />
                <span>Assign Extra Fee</span>
              </Button>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>School Year</TableHead>
                    <TableHead>Fee Description</TableHead>
                    <TableHead>Net Fee</TableHead>
                    <TableHead>Paid</TableHead>
                    <TableHead>Balance</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Assessed Date</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {studentFees.map((fee, idx) => (
                    <TableRow key={idx}>
                      <TableCell className="font-mono text-xs">{fee.year}</TableCell>
                      <TableCell className="font-medium text-xs text-slate-900 dark:text-slate-100">{fee.description}</TableCell>
                      <TableCell className="text-xs">{fee.netFee}</TableCell>
                      <TableCell className="text-xs text-emerald-600 font-medium">{fee.paid}</TableCell>
                      <TableCell className="text-xs text-rose-600 font-bold">{fee.balance}</TableCell>
                      <TableCell>
                        <Badge
                          variant="outline"
                          className={
                            fee.status === 'Paid'
                              ? 'bg-emerald-50 text-emerald-700 border-emerald-200 text-[10px]'
                              : fee.status === 'Partial'
                              ? 'bg-amber-50 text-amber-700 border-amber-200 text-[10px]'
                              : 'bg-rose-50 text-rose-700 border-rose-200 text-[10px]'
                          }
                        >
                          {fee.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right text-xs text-slate-500">{fee.date}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="payments">
          <Card className="border-slate-200 shadow-sm p-6 text-center text-xs text-slate-500">
            Payment records list for this student...
          </Card>
        </TabsContent>

        <TabsContent value="ledger">
          <Card className="border-slate-200 shadow-sm p-6 text-center text-xs text-slate-500">
            Full ledger statement (debits & credits timeline)...
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
