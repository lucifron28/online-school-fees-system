'use client';

import { FileImage, Upload, X } from 'lucide-react';
import { Button } from '@/components/ui/button';

const MAX_FILE_SIZE = 3 * 1024 * 1024;

function formatFileSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.ceil(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

interface ImageUploadFieldProps {
  id: string;
  label: string;
  file: File | null;
  previewUrl: string | null;
  inputKey?: number;
  error?: string;
  onChange: (file: File | null) => void;
  onRemove: () => void;
}

export function ImageUploadField({
  id,
  label,
  file,
  previewUrl,
  inputKey,
  error,
  onChange,
  onRemove,
}: ImageUploadFieldProps) {
  return (
    <div className="space-y-2">
      <div className="flex items-baseline justify-between gap-3">
        <label htmlFor={id} className="text-xs font-semibold text-slate-700 dark:text-slate-300">
          {label}
        </label>
        <span id={`${id}-hint`} className="text-[11px] font-normal text-slate-500">
          JPEG, PNG, or WebP · maximum 3 MB
        </span>
      </div>
      <input
        key={inputKey}
        id={id}
        name={id}
        type="file"
        className="peer sr-only"
        accept="image/jpeg,image/png,image/webp"
        aria-describedby={`${id}-hint${error ? ` ${id}-error` : ''}`}
        onChange={(event) => onChange(event.target.files?.[0] ?? null)}
      />
      <label
        htmlFor={id}
        className="flex min-h-24 cursor-pointer items-center justify-center rounded-xl border border-dashed border-slate-300 bg-slate-50 px-4 py-5 text-center transition-colors hover:border-blue-400 hover:bg-blue-50/60 peer-focus-visible:border-blue-500 peer-focus-visible:ring-2 peer-focus-visible:ring-blue-500 peer-focus-visible:ring-offset-2 dark:border-slate-700 dark:bg-slate-900/60 dark:hover:border-blue-500"
      >
        <span className="flex items-center gap-3 text-xs text-slate-600 dark:text-slate-300">
          <Upload className="h-5 w-5 text-blue-600" aria-hidden="true" />
          <span>
            <span className="block font-semibold text-slate-800 dark:text-slate-100">
              {file ? 'Replace payment screenshot' : 'Choose payment screenshot'}
            </span>
            <span className="mt-1 block text-[11px] text-slate-500">
              Select a clear image of the completed transfer.
            </span>
          </span>
        </span>
      </label>

      {file && (
        <div className="flex items-center justify-between gap-3 rounded-lg border border-slate-200 bg-white p-3 dark:border-slate-800 dark:bg-slate-950">
          <div className="flex min-w-0 items-center gap-2">
            <FileImage className="h-4 w-4 shrink-0 text-blue-600" aria-hidden="true" />
            <div className="min-w-0">
              <p className="truncate text-xs font-semibold">{file.name}</p>
              <p className="text-[11px] text-slate-500">{formatFileSize(file.size)}</p>
            </div>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="shrink-0 text-slate-500 hover:text-rose-700"
            aria-label={`Remove ${file.name}`}
            onClick={onRemove}
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </Button>
        </div>
      )}

      {previewUrl && (
        <div className="rounded-xl border border-slate-200 p-3 dark:border-slate-800">
          <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
            Preview
          </p>
          {/* Blob previews need a native image element; there is no stable URL for next/image to optimize. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={previewUrl}
            alt="Selected payment proof preview"
            className="max-h-64 w-full rounded-lg border object-contain"
          />
        </div>
      )}

      {error && (
        <p id={`${id}-error`} role="alert" className="text-xs text-rose-600">
          {error}
        </p>
      )}
    </div>
  );
}

export { MAX_FILE_SIZE };
