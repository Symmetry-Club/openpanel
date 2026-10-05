import { BRAND } from '@/branding';
import { cn } from '@/utils/cn';

interface LogoProps {
  className?: string;
}

export function LogoSquare({ className }: LogoProps) {
  return (
    <img
      alt={`${BRAND.shortName} logo`}
      className={cn('rounded-md', className)}
      src={BRAND.logoSquare}
    />
  );
}

export function Logo({ className }: LogoProps) {
  return (
    <div
      className={cn('flex items-center gap-2 text-xl font-medium', className)}
    >
      <LogoSquare className="max-h-8" />
      <span>{BRAND.name}</span>
    </div>
  );
}
