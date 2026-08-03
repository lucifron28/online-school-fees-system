'use me';
'use client';

import React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ImagePlaceholder } from '@/components/ui/image-placeholder';
import { Users, Shield, GraduationCap, ArrowRight } from 'lucide-react';

export default function ParentLoginPage() {
  const router = useRouter();

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    router.push('/parent/dashboard');
  };

  return (
    <div className="flex min-h-[calc(100vh-2.5rem)] bg-slate-50 dark:bg-slate-950">
      {/* Form Section */}
      <div className="flex flex-1 flex-col justify-center px-6 py-12 lg:px-12 xl:px-16 bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800">
        <div className="mx-auto w-full max-w-sm">
          <div className="flex flex-col items-center text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-600 text-white shadow-lg mb-4">
              <Users className="h-7 w-7" />
            </div>
            <span className="inline-flex items-center rounded-full bg-emerald-100 dark:bg-emerald-950/60 px-3 py-1 text-xs font-semibold text-emerald-700 dark:text-emerald-300 mb-2 border border-emerald-200 dark:border-emerald-800">
              Screen #9 • PARENT LOGIN
            </span>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
              Parent Portal
            </h1>
            <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
              Sign in to view student ledgers, fee assessments, and make online payments
            </p>
          </div>

          <form onSubmit={handleLogin} className="mt-8 space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Parent Email / Account ID
              </label>
              <Input
                type="email"
                placeholder="parent@example.com"
                defaultValue="juan.delacruz@example.com"
                className="h-10 text-sm"
                required
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Password
                </label>
                <a href="#" className="text-xs text-emerald-600 hover:underline dark:text-emerald-400">
                  Forgot Password?
                </a>
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
                className="h-4 w-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
              />
              <label htmlFor="remember" className="text-xs text-slate-600 dark:text-slate-400">
                Remember me
              </label>
            </div>

            <Button type="submit" className="w-full h-10 bg-emerald-600 hover:bg-emerald-700 text-white font-medium text-sm shadow-md">
              <span>Sign In as Parent</span>
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </form>

          <div className="mt-8 border-t border-slate-200 dark:border-slate-800 pt-6">
            <p className="text-xs text-center text-slate-500 mb-3 font-medium">Switch Login Portal View:</p>
            <div className="grid grid-cols-2 gap-2">
              <Link
                href="/login/admin"
                className="flex items-center justify-center space-x-1.5 p-2 rounded-lg border border-slate-200 dark:border-slate-800 text-xs font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              >
                <Shield className="h-3.5 w-3.5 text-blue-600" />
                <span>Admin Login</span>
              </Link>
              <Link
                href="/login/student"
                className="flex items-center justify-center space-x-1.5 p-2 rounded-lg border border-slate-200 dark:border-slate-800 text-xs font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              >
                <GraduationCap className="h-3.5 w-3.5 text-purple-600" />
                <span>Student Login</span>
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* Hero Image Section */}
      <div className="hidden lg:flex flex-1 p-8 items-center justify-center bg-slate-100 dark:bg-slate-950">
        <ImagePlaceholder type="family" className="h-full max-h-[700px] w-full" />
      </div>
    </div>
  );
}
