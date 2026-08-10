import React from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { FileQuestion, Home } from 'lucide-react';

export default function NotFound() {
  return (
    <div className="flex min-h-[100dvh] flex-col items-center justify-center bg-background px-4 py-12 text-center">
      <div className="mx-auto max-w-md space-y-6">
        <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-2xl bg-blue-100 text-blue-600 dark:bg-blue-950/60 dark:text-blue-400">
          <FileQuestion className="h-10 w-10" />
        </div>

        <div className="space-y-2">
          <h1 className="text-3xl font-bold tracking-tight text-slate-900 dark:text-slate-100 sm:text-4xl">
            Page Not Found
          </h1>
          <p className="text-sm text-muted-foreground">
            The page or record you requested does not exist or has been moved.
          </p>
        </div>

        <div className="flex flex-col items-center justify-center gap-3 pt-2 sm:flex-row">
          <Link href="/">
            <Button className="text-xs font-medium">
              <Home className="mr-1.5 h-4 w-4" />
              <span>Return home</span>
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
