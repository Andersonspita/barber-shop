'use client';

import React from 'react';
import Link from 'next/link';
import { cn } from '@/lib/cn';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'success';
type Size = 'sm' | 'md' | 'lg';

const VARIANTS: Record<Variant, string> = {
  primary:
    'bg-brand-500 text-surface-0 hover:bg-brand-400 active:bg-brand-600 shadow-[0_0_24px_-6px_var(--color-brand-500)]',
  secondary:
    'border border-line-strong bg-surface-2 text-ink hover:bg-surface-3 hover:border-brand-500/50',
  ghost: 'text-ink-muted hover:text-ink hover:bg-surface-2',
  danger:
    'border border-danger/30 bg-danger/10 text-danger hover:bg-danger hover:text-surface-0 hover:border-danger',
  success:
    'border border-success/30 bg-success/10 text-success hover:bg-success hover:text-surface-0 hover:border-success',
};

const SIZES: Record<Size, string> = {
  sm: 'h-9 px-3 text-xs gap-1.5',
  md: 'h-11 px-4 text-sm gap-2',
  lg: 'h-13 px-6 text-base gap-2.5',
};

const BASE =
  'inline-flex items-center justify-center rounded-xl font-semibold transition-colors ' +
  'disabled:opacity-45 disabled:pointer-events-none whitespace-nowrap';

interface CommonProps {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  block?: boolean;
  className?: string;
  children: React.ReactNode;
}

type ButtonProps = CommonProps &
  Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, 'children' | 'className'>;

export function Button({
  variant = 'primary',
  size = 'md',
  loading = false,
  block = false,
  className,
  children,
  disabled,
  ...props
}: ButtonProps) {
  return (
    <button
      {...props}
      disabled={disabled || loading}
      // Leitores de tela precisam saber que o botão está ocupado; só trocar o
      // rótulo para "Aguarde…" não comunica isso.
      aria-busy={loading || undefined}
      className={cn(
        BASE,
        VARIANTS[variant],
        SIZES[size],
        block && 'w-full',
        className,
      )}
    >
      {loading && <Spinner />}
      {children}
    </button>
  );
}

type ButtonLinkProps = CommonProps & { href: string; prefetch?: boolean };

/** Mesmo visual do botão, mas navega pelo roteador — sem recarregar a página. */
export function ButtonLink({
  variant = 'primary',
  size = 'md',
  block = false,
  className,
  children,
  href,
  ...props
}: ButtonLinkProps) {
  return (
    <Link
      href={href}
      {...props}
      className={cn(
        BASE,
        VARIANTS[variant],
        SIZES[size],
        block && 'w-full',
        className,
      )}
    >
      {children}
    </Link>
  );
}

export function Spinner({ className }: { className?: string }) {
  return (
    <svg
      className={cn('h-4 w-4 animate-spin', className)}
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
    >
      <circle
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        strokeWidth="3"
        opacity="0.25"
      />
      <path
        d="M12 2a10 10 0 0 1 10 10"
        stroke="currentColor"
        strokeWidth="3"
        strokeLinecap="round"
      />
    </svg>
  );
}
