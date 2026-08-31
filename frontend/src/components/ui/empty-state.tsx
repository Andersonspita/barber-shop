import React from 'react';

export function EmptyState({
  icon,
  title,
  description,
  action,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="rounded-card border border-dashed border-line-strong bg-surface-1/40 px-6 py-14 text-center">
      <div
        className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-surface-2 text-ink-subtle"
        aria-hidden="true"
      >
        {icon}
      </div>
      <h3 className="font-display text-lg font-bold text-ink">{title}</h3>
      <p className="mx-auto mt-1 max-w-sm text-sm text-ink-muted">
        {description}
      </p>
      {action && <div className="mt-6 flex justify-center">{action}</div>}
    </div>
  );
}
