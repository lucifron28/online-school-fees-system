import React from 'react';
import { FileX } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from './button';

interface EmptyStateProps extends React.HTMLAttributes<HTMLDivElement> {
  title?: string;
  description?: string;
  actionLabel?: string;
  onAction?: () => void;
  icon?: React.ElementType;
}

export function EmptyState({
  title = 'No records found',
  description = 'There are currently no items matching your criteria.',
  actionLabel,
  onAction,
  icon: Icon = FileX,
  className,
  ...props
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center space-y-3 rounded-xl border border-dashed border-slate-300 bg-slate-50/50 p-8 text-center dark:border-slate-800 dark:bg-slate-900/50',
        className
      )}
      {...props}
    >
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 text-slate-400 dark:bg-slate-800">
        <Icon className="h-6 w-6" />
      </div>
      <div>
        <h4 className="text-sm font-semibold text-slate-800 dark:text-slate-200">{title}</h4>
        {description && (
          <p className="mt-1 max-w-sm text-xs text-slate-500 dark:text-slate-400">{description}</p>
        )}
      </div>
      {actionLabel && onAction && (
        <Button onClick={onAction} variant="outline" size="sm" className="mt-2 h-8 text-xs">
          {actionLabel}
        </Button>
      )}
    </div>
  );
}
