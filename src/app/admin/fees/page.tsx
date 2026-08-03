'use client';

import React, { useState } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from '@/components/ui/table';
import { Plus, Edit, Trash2, Tag } from 'lucide-react';

export default function AdminFeesPage() {
  const feesList = [
    {
      name: 'Tuition Fee (Full Year)',
      applicable: 'All Grades',
      amount: '₱12,000.00',
      frequency: 'Yearly',
      status: 'Active',
    },
    {
      name: 'Miscellaneous Fee',
      applicable: 'All Grades',
      amount: '₱2,000.00',
      frequency: 'Yearly',
      status: 'Active',
    },
    {
      name: 'Enrollment Fee',
      applicable: 'All Grades',
      amount: '₱2,500.00',
      frequency: 'Per Semester/Year',
      status: 'Active',
    },
    {
      name: 'Laboratory Fee',
      applicable: 'Grades 11 - 12',
      amount: '₱1,500.00',
      frequency: 'Yearly',
      status: 'Active',
    },
    {
      name: 'Computer Fee',
      applicable: 'All Grades',
      amount: '₱1,000.00',
      frequency: 'Yearly',
      status: 'Active',
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <Badge variant="outline" className="border-blue-200 bg-blue-50 text-blue-700">
            Screen #4 • ADMIN - FEES MANAGEMENT
          </Badge>
          <h2 className="mt-1 text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
            Fees Management
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Configure fee structures, amounts, applicability, and frequency rules
          </p>
        </div>

        <Button className="h-9 bg-blue-600 text-xs text-white hover:bg-blue-700">
          <Plus className="mr-1.5 h-4 w-4" />
          <span>Create New Fee Type</span>
        </Button>
      </div>

      <Tabs defaultValue="fee-list" className="w-full">
        <TabsList className="border border-slate-200 bg-white p-1 dark:border-slate-800">
          <TabsTrigger value="fee-list">Fee List</TabsTrigger>
          <TabsTrigger value="add-fee">Add Fee Structure</TabsTrigger>
        </TabsList>

        <TabsContent value="fee-list">
          <Card className="border-slate-200 shadow-sm dark:border-slate-800">
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Fee Name</TableHead>
                    <TableHead>Applicable To</TableHead>
                    <TableHead>Amount</TableHead>
                    <TableHead>Frequency</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {feesList.map((fee, i) => (
                    <TableRow key={i}>
                      <TableCell className="flex items-center space-x-2 text-xs font-semibold text-slate-900 dark:text-slate-100">
                        <Tag className="h-3.5 w-3.5 text-blue-600" />
                        <span>{fee.name}</span>
                      </TableCell>
                      <TableCell className="text-xs">{fee.applicable}</TableCell>
                      <TableCell className="text-xs font-bold text-slate-900 dark:text-slate-100">
                        {fee.amount}
                      </TableCell>
                      <TableCell className="text-xs text-slate-500">{fee.frequency}</TableCell>
                      <TableCell>
                        <Badge
                          variant="outline"
                          className="border-emerald-200 bg-emerald-50 text-[10px] text-emerald-700"
                        >
                          {fee.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end space-x-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-slate-600 hover:text-slate-900"
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-red-600 hover:bg-red-50 hover:text-red-700"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="add-fee">
          <Card className="max-w-xl border-slate-200 shadow-sm">
            <CardHeader>
              <CardTitle className="text-base font-semibold">Define New Fee Template</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="mb-1 block text-xs font-semibold">Fee Name</label>
                <Input placeholder="e.g. Athletics Fee" className="h-9 text-xs" />
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold">Amount (₱)</label>
                <Input type="number" placeholder="1000" className="h-9 text-xs" />
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold">Applicable Grade Levels</label>
                <select className="h-9 w-full rounded-md border border-slate-200 bg-white px-3 text-xs">
                  <option>All Grades</option>
                  <option>Elementary (Grades 1-6)</option>
                  <option>Junior High (Grades 7-10)</option>
                  <option>Senior High (Grades 11-12)</option>
                </select>
              </div>
              <Button className="h-9 bg-blue-600 text-xs text-white">Save Fee Structure</Button>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
