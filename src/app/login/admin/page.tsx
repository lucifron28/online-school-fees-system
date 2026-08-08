'use client';

import React from 'react';
import Link from 'next/link';
import { ImagePlaceholder } from '@/components/ui/image-placeholder';
import { LoginForm } from '@/components/auth/login-form';
import { Building2, Users, GraduationCap } from 'lucide-react';

export default function AdminLoginPage() {
  return (
    <div className="flex min-h-[calc(100vh-2.5rem)] bg-slate-50 dark:bg-slate-950">
      <div className="flex flex-1 flex-col justify-center border-r border-slate-200 bg-white px-6 py-12 dark:border-slate-800 dark:bg-slate-900 lg:px-12 xl:px-16">
        <div className="mx-auto w-full max-w-sm">
          <div className="flex flex-col items-center text-center">
            <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-600 text-white shadow-lg">
              <Building2 className="h-7 w-7" />
            </div>
            <span className="mb-2 inline-flex items-center rounded-full border border-blue-200 bg-blue-100 px-3 py-1 text-xs font-semibold text-blue-700 dark:border-blue-800 dark:bg-blue-950/60 dark:text-blue-300">
              Screen #1 • ADMIN LOGIN
            </span>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
              School Fees Monitoring and Payment System
            </h1>
            <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
              Please sign in to access the Administrator Portal
            </p>
          </div>

          <LoginForm
            portal="admin"
            defaultEmail="admin@demo.school"
            buttonLabel="Sign In as Admin"
            accentClass="bg-blue-600 hover:bg-blue-700"
            linkClass="text-blue-600 dark:text-blue-400"
            focusClass="dark:focus-visible:ring-blue-500"
          />

          <div className="mt-8 border-t border-slate-200 pt-6 dark:border-slate-800">
            <p className="mb-3 text-center text-xs font-medium text-slate-500">
              Switch Login Portal View:
            </p>
            <div className="grid grid-cols-2 gap-2">
              <Link
                href="/login/parent"
                className="flex items-center justify-center space-x-1.5 rounded-lg border border-slate-200 p-2 text-xs font-medium text-slate-700 transition-colors hover:bg-slate-100 dark:border-slate-800 dark:text-slate-300 dark:hover:bg-slate-800"
              >
                <Users className="h-3.5 w-3.5 text-emerald-600" />
                <span>Parent Login</span>
              </Link>
              <Link
                href="/login/student"
                className="flex items-center justify-center space-x-1.5 rounded-lg border border-slate-200 p-2 text-xs font-medium text-slate-700 transition-colors hover:bg-slate-100 dark:border-slate-800 dark:text-slate-300 dark:hover:bg-slate-800"
              >
                <GraduationCap className="h-3.5 w-3.5 text-purple-600" />
                <span>Student Login</span>
              </Link>
            </div>
          </div>
        </div>
      </div>

      <div className="hidden flex-1 items-center justify-center bg-slate-100 p-8 dark:bg-slate-950 lg:flex">
        <ImagePlaceholder type="school" className="h-full max-h-[700px] w-full" />
      </div>
    </div>
  );
}
