import type { ReactNode } from 'react';
import { BRAND } from '@/branding';
import { LogoSquare } from '@/components/logo';
import { cn } from '@/utils/cn';

/**
 * Minimal centered layout shared by every signed-out screen (sign in,
 * 2FA, password reset, invitation sign-up).
 */
export function AuthShell({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className="flex min-h-screen items-center justify-center px-4 py-12">
      <main className={cn('col w-full max-w-sm gap-8', className)}>
        <div className="center-center">
          <img
            alt={BRAND.name}
            className="hidden h-10 w-auto dark:block"
            src={BRAND.logoWordmark}
          />
          <LogoSquare className="size-12 dark:hidden" />
        </div>
        {children}
      </main>
    </div>
  );
}
