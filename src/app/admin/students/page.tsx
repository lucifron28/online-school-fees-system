'use client';

import React, { useState } from 'react';
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
import {
  Dialog,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Search, Plus, Eye, Edit, Trash2, Filter } from 'lucide-react';

export default function AdminStudentsPage() {
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  const students = [
    {
      id: '2024-0001',
      name: 'Juan Dela Cruz',
      grade: 'Grade 10 - A',
      status: 'Active',
      email: 'juan.delacruz@example.com',
    },
    {
      id: '2024-0002',
      name: 'Maria Santos',
      grade: 'Grade 11 - B',
      status: 'Active',
      email: 'maria.santos@example.com',
    },
    {
      id: '2024-0003',
      name: 'Pedro Reyes',
      grade: 'Grade 12 - A',
      status: 'Active',
      email: 'pedro.reyes@example.com',
    },
    {
      id: '2024-0004',
      name: 'Ana Garcia',
      grade: 'Grade 8 - C',
      status: 'Active',
      email: 'ana.garcia@example.com',
    },
    {
      id: '2024-0005',
      name: 'Liam Johnson',
      grade: 'Grade 10 - A',
      status: 'Inactive',
      email: 'liam.johnson@example.com',
    },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <Badge
            variant="outline"
            className="border-blue-200 bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300"
          >
            Screen #3 • ADMIN - STUDENT LIST
          </Badge>
          <h2 className="mt-1 text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
            Student Directory
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Manage student records, fee assignments, and profile details
          </p>
        </div>

        <Button
          onClick={() => setIsAddOpen(true)}
          className="h-9 bg-blue-600 text-xs text-white hover:bg-blue-700"
        >
          <Plus className="mr-1.5 h-4 w-4" />
          <span>Add New Student</span>
        </Button>
      </div>

      {/* Table Card */}
      <Card className="border-slate-200 shadow-sm dark:border-slate-800">
        <CardHeader className="flex flex-col justify-between gap-4 pb-4 sm:flex-row sm:items-center">
          <div className="relative max-w-md flex-1">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
            <Input
              type="text"
              placeholder="Search student by name or ID..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="h-9 pl-9 text-xs"
            />
          </div>

          <div className="flex items-center space-x-2">
            <select className="h-9 rounded-md border border-slate-200 bg-white px-3 text-xs text-slate-700 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300">
              <option>All Grade Levels</option>
              <option>Grade 7</option>
              <option>Grade 8</option>
              <option>Grade 9</option>
              <option>Grade 10</option>
              <option>Grade 11</option>
              <option>Grade 12</option>
            </select>
          </div>
        </CardHeader>

        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[120px]">Student ID</TableHead>
                <TableHead>Student Name</TableHead>
                <TableHead>Grade & Section</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {students.map((student) => (
                <TableRow key={student.id}>
                  <TableCell className="font-mono text-xs font-semibold">{student.id}</TableCell>
                  <TableCell>
                    <div>
                      <p className="text-xs font-semibold text-slate-900 dark:text-slate-100">
                        {student.name}
                      </p>
                      <p className="text-[11px] text-slate-400">{student.email}</p>
                    </div>
                  </TableCell>
                  <TableCell className="text-xs">{student.grade}</TableCell>
                  <TableCell>
                    <Badge
                      variant="outline"
                      className={
                        student.status === 'Active'
                          ? 'border-emerald-200 bg-emerald-50 text-[10px] text-emerald-700'
                          : 'border-slate-200 bg-slate-100 text-[10px] text-slate-600'
                      }
                    >
                      {student.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end space-x-1">
                      <Link href={`/admin/students/S${student.id}`}>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-blue-600 hover:bg-blue-50 hover:text-blue-700"
                        >
                          <Eye className="h-4 w-4" />
                          <span className="sr-only">View Profile</span>
                        </Button>
                      </Link>
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

          {/* Pagination */}
          <div className="flex items-center justify-between border-t border-slate-100 px-4 py-3 text-xs text-slate-500 dark:border-slate-800">
            <span>Showing 1 to 5 of 1,245 students</span>
            <div className="flex items-center space-x-1">
              <Button variant="outline" size="sm" className="h-7 text-xs" disabled>
                Previous
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="h-7 border-blue-600 bg-blue-600 text-xs text-white"
              >
                1
              </Button>
              <Button variant="outline" size="sm" className="h-7 text-xs">
                2
              </Button>
              <Button variant="outline" size="sm" className="h-7 text-xs">
                3
              </Button>
              <Button variant="outline" size="sm" className="h-7 text-xs">
                Next
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Add Student Modal */}
      <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
        <DialogHeader>
          <DialogTitle>Add New Student Record</DialogTitle>
          <DialogDescription>
            Enter the student personal details and grade assignment.
          </DialogDescription>
        </DialogHeader>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            setIsAddOpen(false);
          }}
          className="space-y-4 py-2"
        >
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-700 dark:text-slate-300">
                First Name
              </label>
              <Input placeholder="e.g. Juan" required className="h-9 text-xs" />
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-700 dark:text-slate-300">
                Last Name
              </label>
              <Input placeholder="e.g. Dela Cruz" required className="h-9 text-xs" />
            </div>
          </div>

          <div>
            <label className="mb-1 block text-xs font-semibold text-slate-700 dark:text-slate-300">
              Grade & Section
            </label>
            <select className="h-9 w-full rounded-md border border-slate-200 bg-white px-3 text-xs dark:border-slate-800 dark:bg-slate-900">
              <option>Grade 10 - A</option>
              <option>Grade 11 - B</option>
              <option>Grade 12 - A</option>
            </select>
          </div>

          <div>
            <label className="mb-1 block text-xs font-semibold text-slate-700 dark:text-slate-300">
              Parent Email
            </label>
            <Input type="email" placeholder="parent@example.com" required className="h-9 text-xs" />
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsAddOpen(false)}
              className="h-9 text-xs"
            >
              Cancel
            </Button>
            <Button type="submit" className="h-9 bg-blue-600 text-xs text-white hover:bg-blue-700">
              Save Student
            </Button>
          </DialogFooter>
        </form>
      </Dialog>
    </div>
  );
}
