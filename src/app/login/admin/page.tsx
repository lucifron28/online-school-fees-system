'use client';

import React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ImagePlaceholder } from '@/components/ui/image-placeholder';
import { Building2, Shield, Users, GraduationCap, ArrowRight } from 'lucide-react';

export default function AdminLoginPage() {
  const router = useRouter();

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    router.push('/admin/dashboard');
  };

  return (
    <div className="flex min-h-[calc(100vh-2.5rem)] bg-slate-50 dark:bg-slate-950">
      {/* Left Form Section */}
      <div className="flex flex-1 flex-col justify-center border-r border-slate-200 bg-white px-6 py-12 dark:border-slate-800 dark:bg-slate-900 lg:px-12 xl:px-16">
        <div className="mx-auto w-full max-w-sm">
          {/* Logo & Title */}
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

          {/* Form */}
          <form onSubmit={handleLogin} className="mt-8 space-y-4">
            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-700 dark:text-slate-300">
                Username / Admin ID
              </label>
              <Input
                type="text"
                placeholder="Enter your username"
                defaultValue="admin_staff"
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
                  className="text-xs text-blue-600 hover:underline dark:text-blue-400"
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
                className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
              />
              <label htmlFor="remember" className="text-xs text-slate-600 dark:text-slate-400">
                Remember me
              </label>
            </div>

            <Button
              type="submit"
              className="h-10 w-full bg-blue-600 text-sm font-medium text-white shadow-md hover:bg-blue-700"
            >
              <span>Sign In as Admin</span>
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </form>

          {/* Role Switcher Footer */}
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

      {/* Right Hero Image Section */}
      <div className="hidden flex-1 items-center justify-center bg-slate-100 p-8 dark:bg-slate-950 lg:flex">
        <ImagePlaceholder type="school" className="h-full max-h-[700px] w-full" />
      </div>
    </div>
  );
}
