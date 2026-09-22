import { cn } from '@/lib/cn';
import { initials } from '@/lib/format';

const SIZES = {
  sm: 'h-9 w-9 text-xs',
  md: 'h-12 w-12 text-sm',
  lg: 'h-16 w-16 text-lg',
  xl: 'h-full w-full text-4xl',
  /** Ocupa o contêiner, com iniciais em tamanho de miniatura. */
  fill: 'h-full w-full text-lg',
} as const;

/**
 * Foto do profissional, com as iniciais como reserva. A versão anterior
 * puxava retratos aleatórios do pravatar.cc e os apresentava como sendo a
 * equipe da casa.
 */
export function Avatar({
  name,
  photoUrl,
  size = 'md',
  className,
}: {
  name: string;
  photoUrl?: string | null;
  size?: keyof typeof SIZES;
  className?: string;
}) {
  if (photoUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element -- URL externa arbitrária, cadastrada pelo admin
      <img
        src={photoUrl}
        alt={name}
        loading="lazy"
        className={cn('object-cover', SIZES[size], className)}
      />
    );
  }

  return (
    <div
      className={cn(
        'flex shrink-0 items-center justify-center bg-surface-3 font-display font-bold tracking-tight text-brand-400',
        SIZES[size],
        className,
      )}
      aria-hidden="true"
    >
      {initials(name)}
    </div>
  );
}
