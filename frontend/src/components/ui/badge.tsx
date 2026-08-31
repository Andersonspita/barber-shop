import React from 'react';
import { cn } from '@/lib/cn';

type Tone = 'neutral' | 'brand' | 'success' | 'danger' | 'warning';

const TONES: Record<Tone, string> = {
  neutral: 'bg-surface-2 text-ink-muted ring-line-strong',
  brand: 'bg-brand-500/12 text-brand-400 ring-brand-500/30',
  success: 'bg-success/12 text-success ring-success/30',
  danger: 'bg-danger/12 text-danger ring-danger/30',
  warning: 'bg-brand-300/12 text-brand-300 ring-brand-300/30',
};

export function Badge({
  tone = 'neutral',
  className,
  children,
}: {
  tone?: Tone;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-semibold ring-1 ring-inset',
        TONES[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}
