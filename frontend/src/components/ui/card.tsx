import React from 'react';
import { cn } from '@/lib/cn';

export function Card({
  className,
  children,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      {...props}
      className={cn(
        'rounded-card border border-line bg-surface-1',
        className,
      )}
    >
      {children}
    </div>
  );
}

export function CardHeader({
  title,
  description,
  actions,
  className,
}: {
  title: React.ReactNode;
  description?: React.ReactNode;
  actions?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        'flex flex-wrap items-start justify-between gap-4 border-b border-line px-5 py-4',
        className,
      )}
    >
      <div className="min-w-0">
        <h2 className="font-display text-lg font-bold tracking-tight text-ink">
          {title}
        </h2>
        {description && (
          <p className="mt-0.5 text-sm text-ink-muted">{description}</p>
        )}
      </div>
      {actions && <div className="flex shrink-0 gap-2">{actions}</div>}
    </div>
  );
}

export function CardBody({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return <div className={cn('p-5', className)}>{children}</div>;
}

/** Número em destaque de um painel de métricas. */
export function StatCard({
  label,
  value,
  hint,
  tone = 'default',
  icon,
}: {
  label: string;
  value: React.ReactNode;
  hint?: string;
  tone?: 'default' | 'brand' | 'success' | 'danger';
  icon?: React.ReactNode;
}) {
  const tones = {
    default: 'text-ink',
    brand: 'text-brand-400',
    success: 'text-success',
    danger: 'text-danger',
  } as const;

  return (
    <Card className="p-5">
      <div className="flex items-start justify-between gap-3">
        <p className="text-xs font-semibold uppercase tracking-wider text-ink-subtle">
          {label}
        </p>
        {icon && <span className="text-ink-subtle">{icon}</span>}
      </div>
      <p
        className={cn(
          'mt-2 font-display text-3xl font-extrabold tracking-tight tabular',
          tones[tone],
        )}
      >
        {value}
      </p>
      {hint && <p className="mt-1 text-xs text-ink-subtle">{hint}</p>}
    </Card>
  );
}
