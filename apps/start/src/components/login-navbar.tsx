import { LogoSquare } from './logo';
import { BRAND } from '@/branding';
import { cn } from '@/utils/cn';

export function LoginNavbar({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        'row absolute top-0 left-0 z-10 w-full items-center justify-between p-8',
        className
      )}
    >
      <div className="row items-center gap-2">
        <LogoSquare className="size-8 shrink-0" />
        <span className="font-medium text-muted-foreground text-sm">
          {BRAND.name}
        </span>
      </div>
    </div>
  );
}
