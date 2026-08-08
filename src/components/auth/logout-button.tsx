'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { signOut } from '@/lib/auth/client';
import { LogOut } from 'lucide-react';
import { cn } from '@/lib/utils';

interface LogoutButtonProps {
  logoutPath: string;
  className?: string;
}

export function LogoutButton({ logoutPath, className }: LogoutButtonProps) {
  const router = useRouter();
  const [isSigningOut, setIsSigningOut] = useState(false);

  return (
    <button
      type="button"
      disabled={isSigningOut}
      onClick={async () => {
        setIsSigningOut(true);
        try {
          await signOut();
        } finally {
          router.replace(logoutPath);
          router.refresh();
          setIsSigningOut(false);
        }
      }}
      className={cn(
        'flex items-center space-x-3 rounded-lg px-3.5 py-2 text-sm text-slate-400 transition-colors hover:bg-red-950/40 hover:text-red-400 disabled:cursor-wait disabled:opacity-60',
        className
      )}
    >
      <LogOut className="h-4 w-4" />
      <span>{isSigningOut ? 'Signing out…' : 'Logout'}</span>
    </button>
  );
}
