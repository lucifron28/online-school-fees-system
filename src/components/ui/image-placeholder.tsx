import React from 'react';
import { cn } from '@/lib/utils';
import { Building2, Users, GraduationCap, User, Image as ImageIcon } from 'lucide-react';

export interface ImagePlaceholderProps extends React.HTMLAttributes<HTMLDivElement> {
  type?: 'school' | 'family' | 'student' | 'avatar' | 'generic';
  label?: string;
  width?: string | number;
  height?: string | number;
  aspectRatio?: string;
}

export function ImagePlaceholder({
  type = 'generic',
  label,
  className,
  style,
  ...props
}: ImagePlaceholderProps) {
  if (type === 'avatar') {
    return (
      <div
        className={cn(
          'flex h-12 w-12 items-center justify-center rounded-full border border-slate-300 bg-slate-200 text-slate-600 shadow-inner dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300',
          className
        )}
        style={style}
        {...props}
      >
        <User className="h-6 w-6" />
      </div>
    );
  }

  if (type === 'school') {
    return (
      <div
        className={cn(
          'relative flex h-full w-full flex-col items-center justify-center overflow-hidden rounded-2xl border border-slate-200/80 bg-gradient-to-br from-blue-500/10 via-slate-100 to-indigo-500/10 p-8 text-center shadow-inner dark:border-slate-800 dark:from-blue-950/40 dark:via-slate-900 dark:to-indigo-950/40',
          className
        )}
        style={style}
        {...props}
      >
        {/* Background decorative elements */}
        <div className="absolute -right-12 -top-12 h-48 w-48 rounded-full bg-blue-500/10 blur-2xl" />
        <div className="absolute -bottom-12 -left-12 h-48 w-48 rounded-full bg-indigo-500/10 blur-2xl" />

        <div className="relative z-10 flex flex-col items-center space-y-4">
          <div className="flex h-20 w-20 items-center justify-center rounded-2xl border border-blue-200 bg-blue-600/10 text-blue-600 shadow-sm dark:border-blue-800 dark:bg-blue-500/20 dark:text-blue-400">
            <Building2 className="h-10 w-10" />
          </div>
          <div>
            <h4 className="text-base font-semibold text-slate-800 dark:text-slate-200">
              [Image Placeholder: School Campus Building]
            </h4>
            <p className="mt-1 max-w-xs text-xs text-slate-500 dark:text-slate-400">
              Primary campus facade illustration or photograph placeholder for Admin Login portal
            </p>
          </div>
          <span className="inline-flex items-center rounded-full bg-blue-100 px-3 py-1 font-mono text-xs font-medium text-blue-700 dark:bg-blue-900/60 dark:text-blue-300">
            1536 × 1024 • campus-hero.png
          </span>
        </div>
      </div>
    );
  }

  if (type === 'family') {
    return (
      <div
        className={cn(
          'relative flex h-full w-full flex-col items-center justify-center overflow-hidden rounded-2xl border border-slate-200/80 bg-gradient-to-br from-emerald-500/10 via-slate-100 to-teal-500/10 p-8 text-center shadow-inner dark:border-slate-800 dark:from-emerald-950/40 dark:via-slate-900 dark:to-teal-950/40',
          className
        )}
        style={style}
        {...props}
      >
        <div className="absolute -bottom-12 -right-12 h-48 w-48 rounded-full bg-emerald-500/10 blur-2xl" />
        <div className="relative z-10 flex flex-col items-center space-y-4">
          <div className="flex h-20 w-20 items-center justify-center rounded-2xl border border-emerald-200 bg-emerald-600/10 text-emerald-600 shadow-sm dark:border-emerald-800 dark:bg-emerald-500/20 dark:text-emerald-400">
            <Users className="h-10 w-10" />
          </div>
          <div>
            <h4 className="text-base font-semibold text-slate-800 dark:text-slate-200">
              [Image Placeholder: Parent & Student Illustration]
            </h4>
            <p className="mt-1 max-w-xs text-xs text-slate-500 dark:text-slate-400">
              Warm family graphic depicting parent and student for Parent Portal login
            </p>
          </div>
          <span className="inline-flex items-center rounded-full bg-emerald-100 px-3 py-1 font-mono text-xs font-medium text-emerald-700 dark:bg-emerald-900/60 dark:text-emerald-300">
            parent-student-hero.png
          </span>
        </div>
      </div>
    );
  }

  if (type === 'student') {
    return (
      <div
        className={cn(
          'relative flex h-full w-full flex-col items-center justify-center overflow-hidden rounded-2xl border border-slate-200/80 bg-gradient-to-br from-purple-500/10 via-slate-100 to-indigo-500/10 p-8 text-center shadow-inner dark:border-slate-800 dark:from-purple-950/40 dark:via-slate-900 dark:to-indigo-950/40',
          className
        )}
        style={style}
        {...props}
      >
        <div className="absolute -left-12 -top-12 h-48 w-48 rounded-full bg-purple-500/10 blur-2xl" />
        <div className="relative z-10 flex flex-col items-center space-y-4">
          <div className="flex h-20 w-20 items-center justify-center rounded-2xl border border-purple-200 bg-purple-600/10 text-purple-600 shadow-sm dark:border-purple-800 dark:bg-purple-500/20 dark:text-purple-400">
            <GraduationCap className="h-10 w-10" />
          </div>
          <div>
            <h4 className="text-base font-semibold text-slate-800 dark:text-slate-200">
              [Image Placeholder: Student Character Illustration]
            </h4>
            <p className="mt-1 max-w-xs text-xs text-slate-500 dark:text-slate-400">
              Friendly student illustration for Student Portal login screen
            </p>
          </div>
          <span className="inline-flex items-center rounded-full bg-purple-100 px-3 py-1 font-mono text-xs font-medium text-purple-700 dark:bg-purple-900/60 dark:text-purple-300">
            student-hero.png
          </span>
        </div>
      </div>
    );
  }

  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center rounded-lg border-2 border-dashed border-slate-300 bg-slate-50 p-6 text-center text-slate-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-400',
        className
      )}
      style={style}
      {...props}
    >
      <ImageIcon className="mb-2 h-8 w-8 opacity-60" />
      <span className="text-sm font-medium">{label || '[ Image Placeholder ]'}</span>
    </div>
  );
}
