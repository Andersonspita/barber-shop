'use client';

import React, { useId } from 'react';
import { cn } from '@/lib/cn';

const CONTROL =
  'w-full rounded-xl border border-line-strong bg-surface-2 px-4 text-sm text-ink ' +
  'placeholder:text-ink-subtle transition-colors ' +
  'hover:border-line-strong focus:border-brand-500 ' +
  'disabled:opacity-50 disabled:cursor-not-allowed';

interface FieldWrapperProps {
  label: string;
  hint?: string;
  error?: string;
  /** Rótulo só para leitor de tela, quando o desenho não comporta texto. */
  hideLabel?: boolean;
  children: (props: {
    id: string;
    'aria-describedby'?: string;
    'aria-invalid'?: true;
  }) => React.ReactNode;
}

/**
 * Um rótulo real ligado ao controle, com dica e erro anunciados via
 * `aria-describedby`. As telas antigas usavam `<label>` solto, sem `htmlFor`,
 * o que deixava o clique no rótulo sem efeito e o leitor de tela sem contexto.
 */
export function Field({
  label,
  hint,
  error,
  hideLabel,
  children,
}: FieldWrapperProps) {
  const id = useId();
  const hintId = hint ? `${id}-hint` : undefined;
  const errorId = error ? `${id}-error` : undefined;
  const describedBy = [hintId, errorId].filter(Boolean).join(' ') || undefined;

  return (
    <div>
      <label
        htmlFor={id}
        className={cn(
          'mb-2 block text-xs font-semibold uppercase tracking-wider text-ink-muted',
          hideLabel && 'sr-only',
        )}
      >
        {label}
      </label>

      {children({
        id,
        'aria-describedby': describedBy,
        'aria-invalid': error ? true : undefined,
      })}

      {hint && !error && (
        <p id={hintId} className="mt-1.5 text-xs text-ink-subtle">
          {hint}
        </p>
      )}
      {error && (
        <p id={errorId} className="mt-1.5 text-xs font-medium text-danger">
          {error}
        </p>
      )}
    </div>
  );
}

export const Input = React.forwardRef<
  HTMLInputElement,
  React.InputHTMLAttributes<HTMLInputElement>
>(function Input({ className, ...props }, ref) {
  return (
    <input
      ref={ref}
      {...props}
      className={cn(CONTROL, 'h-12', className)}
    />
  );
});

export const Textarea = React.forwardRef<
  HTMLTextAreaElement,
  React.TextareaHTMLAttributes<HTMLTextAreaElement>
>(function Textarea({ className, ...props }, ref) {
  return (
    <textarea
      ref={ref}
      {...props}
      className={cn(CONTROL, 'min-h-24 resize-y py-3', className)}
    />
  );
});

export const Select = React.forwardRef<
  HTMLSelectElement,
  React.SelectHTMLAttributes<HTMLSelectElement>
>(function Select({ className, children, ...props }, ref) {
  return (
    <select
      ref={ref}
      {...props}
      className={cn(CONTROL, 'h-12 cursor-pointer pr-10', className)}
    >
      {children}
    </select>
  );
});

/** Caixa de seleção com rótulo clicável. */
export function Checkbox({
  label,
  description,
  className,
  ...props
}: React.InputHTMLAttributes<HTMLInputElement> & {
  label: string;
  description?: string;
}) {
  const id = useId();
  return (
    <div className={cn('flex items-start gap-3', className)}>
      <input
        id={id}
        type="checkbox"
        {...props}
        className="mt-0.5 h-5 w-5 shrink-0 cursor-pointer accent-[var(--color-brand-500)]"
      />
      <label htmlFor={id} className="cursor-pointer select-none">
        <span className="block text-sm font-medium text-ink">{label}</span>
        {description && (
          <span className="block text-xs text-ink-subtle">{description}</span>
        )}
      </label>
    </div>
  );
}
