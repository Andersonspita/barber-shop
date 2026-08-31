import { cn } from '@/lib/cn';

/**
 * Esqueleto no lugar do "CARREGANDO AGENDA…" em tela cheia, que trocava a
 * página inteira por um flash preto e devolvia o layout com um salto.
 */
export function Skeleton({ className }: { className?: string }) {
  return (
    <div
      className={cn('animate-pulse rounded-xl bg-surface-2', className)}
      aria-hidden="true"
    />
  );
}

export function SkeletonList({
  count = 3,
  className = 'h-28',
}: {
  count?: number;
  className?: string;
}) {
  return (
    <div className="space-y-3" aria-hidden="true">
      {Array.from({ length: count }, (_, index) => (
        <Skeleton key={index} className={className} />
      ))}
    </div>
  );
}
