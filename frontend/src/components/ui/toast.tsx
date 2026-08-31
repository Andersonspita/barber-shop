'use client';

import React, {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
} from 'react';
import { CheckCircle2, Info, TriangleAlert, X } from 'lucide-react';
import { cn } from '@/lib/cn';

type Tone = 'success' | 'error' | 'info';

interface Toast {
  id: number;
  tone: Tone;
  title: string;
  description?: string;
}

interface ToastApi {
  success: (title: string, description?: string) => void;
  error: (title: string, description?: string) => void;
  info: (title: string, description?: string) => void;
}

const ToastContext = createContext<ToastApi | null>(null);

/**
 * O painel do barbeiro já tinha um toast bem-feito, usado só ali; cadastro,
 * cancelamento e troca de senha caíam no `alert()` do navegador. Agora é um
 * componente só, disponível em todas as telas.
 */
export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const dismiss = useCallback((id: number) => {
    setToasts((current) => current.filter((toast) => toast.id !== id));
  }, []);

  const push = useCallback(
    (tone: Tone, title: string, description?: string) => {
      const id = Date.now() + Math.random();
      setToasts((current) => [...current, { id, tone, title, description }]);
      window.setTimeout(() => dismiss(id), tone === 'error' ? 7000 : 4500);
    },
    [dismiss],
  );

  const api = useMemo<ToastApi>(
    () => ({
      success: (title, description) => push('success', title, description),
      error: (title, description) => push('error', title, description),
      info: (title, description) => push('info', title, description),
    }),
    [push],
  );

  return (
    <ToastContext.Provider value={api}>
      {children}

      {/* `polite` para não interromper o que o leitor de tela está falando. */}
      <div
        role="status"
        aria-live="polite"
        className="pointer-events-none fixed inset-x-0 bottom-0 z-[60] flex flex-col items-center gap-2 p-4 sm:bottom-6"
      >
        {toasts.map((toast) => (
          <ToastCard key={toast.id} toast={toast} onDismiss={dismiss} />
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastApi {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast precisa estar dentro de <ToastProvider>.');
  }
  return context;
}

const TONES = {
  success: {
    ring: 'border-success/30 bg-success/10',
    icon: 'text-success',
    Icon: CheckCircle2,
  },
  error: {
    ring: 'border-danger/30 bg-danger/10',
    icon: 'text-danger',
    Icon: TriangleAlert,
  },
  info: {
    ring: 'border-brand-500/30 bg-brand-500/10',
    icon: 'text-brand-400',
    Icon: Info,
  },
} as const;

function ToastCard({
  toast,
  onDismiss,
}: {
  toast: Toast;
  onDismiss: (id: number) => void;
}) {
  const { ring, icon, Icon } = TONES[toast.tone];

  return (
    <div
      className={cn(
        'pointer-events-auto flex w-full max-w-md items-start gap-3 rounded-xl border p-4 shadow-2xl backdrop-blur-md',
        ring,
      )}
    >
      <Icon className={cn('mt-0.5 h-5 w-5 shrink-0', icon)} aria-hidden="true" />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-ink">{toast.title}</p>
        {toast.description && (
          <p className="mt-0.5 text-xs leading-relaxed text-ink-muted">
            {toast.description}
          </p>
        )}
      </div>
      <button
        type="button"
        onClick={() => onDismiss(toast.id)}
        aria-label="Dispensar aviso"
        className="rounded-md p-1 text-ink-subtle transition-colors hover:bg-surface-2 hover:text-ink"
      >
        <X className="h-3.5 w-3.5" aria-hidden="true" />
      </button>
    </div>
  );
}
