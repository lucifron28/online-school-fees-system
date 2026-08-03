import React from 'react';
import { Loader2 } from 'lucide-react';

export default function Loading() {
  return (
    <div className="flex min-h-[50vh] w-full items-center justify-center p-8">
      <div className="flex flex-col items-center space-y-3 text-center">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600 dark:text-blue-400" />
        <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
          Loading page resources...
        </p>
      </div>
    </div>
  );
}
