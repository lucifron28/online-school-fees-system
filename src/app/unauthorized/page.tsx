import React from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { ShieldAlert, Home, LogIn } from 'lucide-react';

export default function UnauthorizedPage() {
  return (
    <div className="flex min-h-[100dvh] flex-col items-center justify-center bg-background px-4 py-12 text-center">
      <div className="mx-auto max-w-md space-y-6">
        <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-2xl bg-amber-100 text-amber-600 dark:bg-amber-950/60 dark:text-amber-400">
          <ShieldAlert className="h-10 w-10" />
        </div>

        <div className="space-y-2">
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100 sm:text-3xl">
            Access Denied
          </h1>
          <p className="text-xs text-muted-foreground">
            You do not have permission to view or manage this portal or resource. Please log in with
            an authorized account role.
          </p>
        </div>

        <div className="flex flex-col items-center justify-center gap-3 pt-2 sm:flex-row">
          <Link href="/login/admin">
            <Button className="text-xs font-medium">
              <LogIn className="mr-1.5 h-4 w-4" />
              <span>Go to Login</span>
            </Button>
          </Link>
          <Link href="/">
            <Button variant="outline" className="text-xs">
              <Home className="mr-1.5 h-4 w-4" />
              <span>Return home</span>
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
