'use client';

import Link from 'next/link';
import { use } from 'react';
import { useQuery } from '@tanstack/react-query';
import { requestJson, getClientErrorMessage } from '@/lib/client-api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { ArrowLeft, CreditCard, Mail, MapPin, Phone, RefreshCw } from 'lucide-react';

type StudentDetail = {
  id: string;
  studentNumber: string;
  firstName: string;
  lastName: string;
  email: string;
  userId: string | null;
  gradeLevelName: string | null;
  sectionName: string | null;
  schoolYearName: string | null;
  status: string;
  createdAt: string;
  guardians: Array<{
    id: string;
    firstName: string;
    lastName: string;
    email: string;
    phone: string;
    relationship: string;
    isPrimary: boolean;
  }>;
};

export default function AdminStudentProfilePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const studentQuery = useQuery({
    queryKey: ['admin-student', id],
    queryFn: () => requestJson<StudentDetail>(`/api/admin/students/${id}`),
  });

  if (studentQuery.isLoading) {
    return <p className="p-6 text-sm text-slate-500">Loading student record…</p>;
  }
  if (studentQuery.isError || !studentQuery.data) {
    return (
      <Card className="border-red-100 p-6">
        <p className="text-sm text-red-600">{getClientErrorMessage(studentQuery.error)}</p>
        <Button className="mt-4" variant="outline" onClick={() => void studentQuery.refetch()}>
          <RefreshCw className="mr-1 h-3.5 w-3.5" /> Retry
        </Button>
      </Card>
    );
  }

  const student = studentQuery.data;
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Link href="/admin/students">
            <Button variant="outline" size="sm" className="text-xs">
              <ArrowLeft className="mr-1 h-4 w-4" /> Back to students
            </Button>
          </Link>
          <Badge variant="outline" className="border-blue-200 bg-blue-50 text-blue-700">
            Student profile
          </Badge>
        </div>
        <Link href="/admin/payments/manual">
          <Button className="bg-blue-600 text-xs text-white hover:bg-blue-700">
            <CreditCard className="mr-1.5 h-4 w-4" /> Process payment
          </Button>
        </Link>
      </div>

      <Card className="border-slate-200 shadow-sm dark:border-slate-800">
        <CardContent className="p-6">
          <div className="flex flex-col justify-between gap-5 md:flex-row md:items-center">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-xl font-bold">
                  {student.firstName} {student.lastName}
                </h2>
                <Badge variant="outline" className="text-[10px]">
                  {student.status}
                </Badge>
              </div>
              <p className="mt-1 font-mono text-xs text-slate-500">
                Student number: {student.studentNumber}
              </p>
              <div className="mt-4 flex flex-wrap gap-4 text-xs text-slate-600 dark:text-slate-400">
                <span>
                  {student.gradeLevelName ?? 'No grade level'} ·{' '}
                  {student.sectionName ?? 'No section'}
                </span>
                <span>{student.schoolYearName ?? 'No school year'}</span>
                <span className="flex items-center gap-1">
                  <Mail className="h-3.5 w-3.5" /> {student.email}
                </span>
                {student.userId && <span>Student account linked</span>}
              </div>
            </div>
            <div className="rounded-xl border border-blue-100 bg-blue-50 px-5 py-4 text-right dark:border-blue-900/40 dark:bg-blue-950/40">
              <span className="text-xs text-slate-500">Record created</span>
              <p className="mt-1 text-sm font-bold text-blue-700 dark:text-blue-300">
                {new Date(student.createdAt).toLocaleDateString('en-PH')}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="border-slate-200 shadow-sm dark:border-slate-800">
          <CardHeader>
            <CardTitle className="text-base">Contact details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-slate-600 dark:text-slate-400">
            <p className="flex items-center gap-2">
              <Mail className="h-4 w-4" /> {student.email}
            </p>
            <p className="flex items-center gap-2">
              <Phone className="h-4 w-4" /> Student phone is maintained on the account.
            </p>
            <p className="flex items-center gap-2">
              <MapPin className="h-4 w-4" /> Guardian address is shown below.
            </p>
          </CardContent>
        </Card>
        <Card className="border-slate-200 shadow-sm dark:border-slate-800">
          <CardHeader>
            <CardTitle className="text-base">Linked guardians</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Relationship</TableHead>
                  <TableHead>Contact</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {student.guardians.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={3} className="py-8 text-center text-xs text-slate-500">
                      No guardians linked.
                    </TableCell>
                  </TableRow>
                )}
                {student.guardians.map((guardian) => (
                  <TableRow key={guardian.id}>
                    <TableCell className="text-xs font-semibold">
                      {guardian.firstName} {guardian.lastName}
                      {guardian.isPrimary && <span className="ml-1 text-blue-600">(Primary)</span>}
                    </TableCell>
                    <TableCell className="text-xs">{guardian.relationship}</TableCell>
                    <TableCell className="text-xs text-slate-500">
                      {guardian.email}
                      <br />
                      {guardian.phone}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>

      <Card className="border-slate-200 p-6 text-sm text-slate-500 shadow-sm dark:border-slate-800">
        Assessments, payments, and ledger entries will appear here as those phase services are
        connected to this student record.
      </Card>
    </div>
  );
}
