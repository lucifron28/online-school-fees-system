'use client';

import React from 'react';
import Link from 'next/link';
import { ImagePlaceholder } from '@/components/ui/image-placeholder';
import { LoginForm } from '@/components/auth/login-form';
import { Users, Shield, GraduationCap } from 'lucide-react';

export default function ParentLoginPage() {
  return (
    <div className="flex min-h-[calc(100vh-2.5rem)] bg-slate-50 dark:bg-slate-950">
      <div className="flex flex-1 flex-col justify-center border-r border-slate-200 bg-white px-6 py-12 dark:border-slate-800 dark:bg-slate-900 lg:px-12 xl:px-16">
        <div className="mx-auto w-full max-w-sm">
          <div className="flex flex-col items-center text-center">
            <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-600 text-white shadow-lg">
              <Users className="h-7 w-7" />
            </div>
            <span className="mb-2 inline-flex items-center rounded-full border border-emerald-200 bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300">
              Screen #9 • PARENT LOGIN
            </span>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
              Parent Portal
            </h1>
            <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
              Sign in to view student ledgers, fee assessments, and make online payments
            </p>
          </div>

          <LoginForm
            portal="parent"
            defaultEmail="parent@demo.school"
            buttonLabel="Sign In as Parent"
            accentClass="bg-emerald-600 hover:bg-emerald-700"
            linkClass="text-emerald-600 dark:text-emerald-400"
            focusClass="dark:focus-visible:ring-emerald-500"
          />

          <div className="mt-8 border-t border-slate-200 pt-6 dark:border-slate-800">
            <p className="mb-3 text-center text-xs font-medium text-slate-500">
              Switch Login Portal View:
            </p>
            <div className="grid grid-cols-2 gap-2">
              <Link
                href="/login/admin"
                className="flex items-center justify-center space-x-1.5 rounded-lg border border-slate-200 p-2 text-xs font-medium text-slate-700 transition-colors hover:bg-slate-100 dark:border-slate-800 dark:text-slate-300 dark:hover:bg-slate-800"
              >
                <Shield className="h-3.5 w-3.5 text-blue-600" />
                <span>Admin Login</span>
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
        <ImagePlaceholder type="family" className="h-full max-h-[700px] w-full" />
      </div>
    </div>
  );
}
