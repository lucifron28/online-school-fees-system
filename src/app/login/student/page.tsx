'use client';

import React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ImagePlaceholder } from '@/components/ui/image-placeholder';
import { GraduationCap, Shield, Users, ArrowRight } from 'lucide-react';

export default function StudentLoginPage() {
  const router = useRouter();

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    router.push('/student/dashboard');
  };

  return (
    <div className="flex min-h-[calc(100vh-2.5rem)] bg-slate-50 dark:bg-slate-950">
      {/* Form Section */}
      <div className="flex flex-1 flex-col justify-center border-r border-slate-200 bg-white px-6 py-12 dark:border-slate-800 dark:bg-slate-900 lg:px-12 xl:px-16">
        <div className="mx-auto w-full max-w-sm">
          <div className="flex flex-col items-center text-center">
            <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-purple-600 text-white shadow-lg">
              <GraduationCap className="h-7 w-7" />
            </div>
            <span className="mb-2 inline-flex items-center rounded-full border border-purple-200 bg-purple-100 px-3 py-1 text-xs font-semibold text-purple-700 dark:border-purple-800 dark:bg-purple-950/60 dark:text-purple-300">
              Screen #15 • STUDENT LOGIN
            </span>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
              Student Portal
            </h1>
            <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
              School Fees Monitoring and Payment System
            </p>
          </div>

          <form onSubmit={handleLogin} className="mt-8 space-y-4">
            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-700 dark:text-slate-300">
                Student ID / LRN Number
              </label>
              <Input
                type="text"
                placeholder="S2024-0001"
                defaultValue="2024-0001"
                className="h-10 text-sm"
                required
              />
            </div>

            <div>
              <div className="mb-1 flex items-center justify-between">
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Password
                </label>
                <button
                  type="button"
                  onClick={() => alert('Password reset is managed by the School Administrator.')}
                  className="text-xs text-purple-600 hover:underline dark:text-purple-400"
                >
                  Forgot Password?
                </button>
              </div>
              <Input
                type="password"
                placeholder="Enter password"
                defaultValue="••••••••"
                className="h-10 text-sm"
                required
              />
            </div>

            <div className="flex items-center space-x-2">
              <input
                type="checkbox"
                id="remember"
                defaultChecked
                className="h-4 w-4 rounded border-slate-300 text-purple-600 focus:ring-purple-500"
              />
              <label htmlFor="remember" className="text-xs text-slate-600 dark:text-slate-400">
                Remember me
              </label>
            </div>

            <Button
              type="submit"
              className="h-10 w-full bg-purple-600 text-sm font-medium text-white shadow-md hover:bg-purple-700"
            >
              <span>Sign In as Student</span>
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </form>

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
                href="/login/parent"
                className="flex items-center justify-center space-x-1.5 rounded-lg border border-slate-200 p-2 text-xs font-medium text-slate-700 transition-colors hover:bg-slate-100 dark:border-slate-800 dark:text-slate-300 dark:hover:bg-slate-800"
              >
                <Users className="h-3.5 w-3.5 text-emerald-600" />
                <span>Parent Login</span>
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* Hero Image Section */}
      <div className="hidden flex-1 items-center justify-center bg-slate-100 p-8 dark:bg-slate-950 lg:flex">
        <ImagePlaceholder type="student" className="h-full max-h-[700px] w-full" />
      </div>
    </div>
  );
}
