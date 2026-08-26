'use client';

import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface PaginationControlsProps {
  page: number;
  pageSize: number;
  total: number;
  pageCount: number;
  isFetching?: boolean;
  onPageChange: (page: number) => void;
}

export function PaginationControls({
  page,
  pageSize,
  total,
  pageCount,
  isFetching = false,
  onPageChange,
}: PaginationControlsProps) {
  if (pageCount <= 1) return null;
  const first = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const last = Math.min(page * pageSize, total);

  return (
    <nav
      aria-label="Pagination"
      className="flex flex-wrap items-center justify-between gap-3 border-t px-4 py-3 text-xs text-slate-500"
    >
      <span>
        Showing {first}–{last} of {total}
      </span>
      <div className="flex gap-2">
        <Button
          variant="outline"
          size="sm"
          className="h-10 text-xs"
          aria-label="Previous page"
          disabled={page <= 1 || isFetching}
          onClick={() => onPageChange(Math.max(1, page - 1))}
        >
          <ChevronLeft className="mr-1 h-3.5 w-3.5" aria-hidden="true" /> Previous
        </Button>
        <Button
          variant="outline"
          size="sm"
          className="h-10 text-xs"
          aria-label="Next page"
          disabled={page >= pageCount || isFetching}
          onClick={() => onPageChange(Math.min(pageCount, page + 1))}
        >
          Next <ChevronRight className="ml-1 h-3.5 w-3.5" aria-hidden="true" />
        </Button>
      </div>
    </nav>
  );
}
