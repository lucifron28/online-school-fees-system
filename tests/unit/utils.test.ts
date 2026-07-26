import { describe, it, expect } from 'vitest';
import { cn } from '@/lib/utils';

describe('cn utility', () => {
  it('combines class names and resolves tailwind conflicts', () => {
    const result = cn('px-2 py-1', 'bg-red-500', { 'text-white': true, hidden: false });
    expect(result).toBe('px-2 py-1 bg-red-500 text-white');
  });
});
