import { cn } from '../lib/utils';

interface SkeletonProps {
  className?: string;
  variant?: 'text' | 'circle' | 'rect';
  count?: number;
}

export function Skeleton({ className, variant = 'text', count = 1 }: SkeletonProps) {
  const baseClass = cn(
    'skeleton',
    variant === 'text' && 'h-3 w-full rounded',
    variant === 'circle' && 'w-8 h-8 rounded-full',
    variant === 'rect' && 'h-20 w-full rounded-lg',
    className
  );

  if (count === 1) return <div className={baseClass} />;

  return (
    <div className="space-y-2.5">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className={cn(baseClass, i === count - 1 && 'w-3/4')} />
      ))}
    </div>
  );
}

export function SkeletonCard() {
  return (
    <div className="panel">
      <div className="panel-header">
        <Skeleton className="h-3 w-32" />
      </div>
      <div className="panel-body space-y-4">
        <Skeleton count={3} />
        <Skeleton variant="rect" className="h-16" />
      </div>
    </div>
  );
}

export function SkeletonVitals() {
  return (
    <div className="flex items-center gap-4 px-4 h-12">
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="flex flex-col items-center gap-1">
          <Skeleton className="h-2 w-6" />
          <Skeleton className="h-4 w-10" />
          <Skeleton className="h-2 w-5" />
        </div>
      ))}
    </div>
  );
}
