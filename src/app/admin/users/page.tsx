'use client';

import React, { useState } from 'react';
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
import { Search, UserCheck, Shield, UserX, Plus, Edit } from 'lucide-react';

export default function AdminUsersPage() {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedRole, setSelectedRole] = useState('ALL');

  const [users, setUsers] = useState([
    {
      id: 'usr-admin-demo',
      name: 'System Administrator',
      email: 'admin@demo.school',
      role: 'ADMIN',
      active: true,
      created: '2024-05-01',
    },
    {
      id: 'usr-finance-demo',
      name: 'Finance Staff',
      email: 'finance@demo.school',
      role: 'FINANCE_STAFF',
      active: true,
      created: '2024-05-01',
    },
    {
      id: 'usr-parent-demo',
      name: 'Juan Dela Cruz Sr.',
      email: 'parent@demo.school',
      role: 'PARENT',
      active: true,
      created: '2024-05-02',
    },
    {
      id: 'usr-student-demo',
      name: 'Juan Dela Cruz Jr.',
      email: 'student@demo.school',
      role: 'STUDENT',
      active: true,
      created: '2024-05-02',
    },
  ]);

  const toggleUserStatus = (userId: string) => {
    setUsers((prev) => prev.map((u) => (u.id === userId ? { ...u, active: !u.active } : u)));
  };

  const filteredUsers = users.filter((u) => {
    const matchesSearch =
      u.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      u.email.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesRole = selectedRole === 'ALL' || u.role === selectedRole;
    return matchesSearch && matchesRole;
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <Badge variant="outline" className="border-blue-200 bg-blue-50 text-blue-700">
            Admin • USER MANAGEMENT
          </Badge>
          <h2 className="mt-1 text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
            System User Accounts
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Manage user roles, activate/disable access, and review registered portal accounts
          </p>
        </div>

        <Button className="h-9 bg-blue-600 text-xs text-white hover:bg-blue-700">
          <Plus className="mr-1.5 h-4 w-4" />
          <span>Create User Account</span>
        </Button>
      </div>

      <Card className="border-slate-200 shadow-sm dark:border-slate-800">
        <CardHeader className="flex flex-col justify-between gap-4 pb-4 sm:flex-row sm:items-center">
          <div className="relative max-w-md flex-1">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
            <Input
              type="text"
              placeholder="Search user by name or email..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="h-9 pl-9 text-xs"
            />
          </div>

          <div className="flex items-center space-x-2">
            <select
              value={selectedRole}
              onChange={(e) => setSelectedRole(e.target.value)}
              className="h-9 rounded-md border border-slate-200 bg-white px-3 text-xs text-slate-700 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300"
            >
              <option value="ALL">All System Roles</option>
              <option value="ADMIN">ADMIN</option>
              <option value="FINANCE_STAFF">FINANCE_STAFF</option>
              <option value="PARENT">PARENT</option>
              <option value="STUDENT">STUDENT</option>
            </select>
          </div>
        </CardHeader>

        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>User Name</TableHead>
                <TableHead>Email Address</TableHead>
                <TableHead>System Role</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Account Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredUsers.map((user) => (
                <TableRow key={user.id}>
                  <TableCell className="text-xs font-semibold text-slate-900 dark:text-slate-100">
                    {user.name}
                  </TableCell>
                  <TableCell className="font-mono text-xs text-slate-500">{user.email}</TableCell>
                  <TableCell>
                    <Badge
                      variant="outline"
                      className={
                        user.role === 'ADMIN'
                          ? 'border-blue-200 bg-blue-50 text-[10px] text-blue-700'
                          : user.role === 'FINANCE_STAFF'
                            ? 'border-emerald-200 bg-emerald-50 text-[10px] text-emerald-700'
                            : user.role === 'PARENT'
                              ? 'border-amber-200 bg-amber-50 text-[10px] text-amber-700'
                              : 'border-purple-200 bg-purple-50 text-[10px] text-purple-700'
                      }
                    >
                      {user.role}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant="outline"
                      className={
                        user.active
                          ? 'border-emerald-200 bg-emerald-50 text-[10px] text-emerald-700'
                          : 'border-rose-200 bg-rose-50 text-[10px] text-rose-700'
                      }
                    >
                      {user.active ? 'Active' : 'Disabled'}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => toggleUserStatus(user.id)}
                      className={
                        user.active
                          ? 'h-8 text-xs text-rose-600 hover:bg-rose-50 hover:text-rose-700'
                          : 'h-8 text-xs text-emerald-600 hover:bg-emerald-50 hover:text-emerald-700'
                      }
                    >
                      {user.active ? (
                        <>
                          <UserX className="mr-1 h-3.5 w-3.5" />
                          <span>Disable</span>
                        </>
                      ) : (
                        <>
                          <UserCheck className="mr-1 h-3.5 w-3.5" />
                          <span>Activate</span>
                        </>
                      )}
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
