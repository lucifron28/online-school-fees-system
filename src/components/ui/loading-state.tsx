import React from 'react';
import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface LoadingStateProps extends React.HTMLAttributes<HTMLDivElement> {
  label?: string;
}

export function LoadingState({ label = 'Loading...', className, ...props }: LoadingStateProps) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center space-y-3 p-8 text-center',
        className
      )}
      {...props}
    >
      <Loader2 className="h-6 w-6 animate-spin text-blue-600 dark:text-blue-400" />
      <span className="text-xs font-medium text-slate-500 dark:text-slate-400">{label}</span>
    </div>
  );
}
