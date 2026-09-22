'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { CalendarCheck } from 'lucide-react';
import { cn } from '@/lib/cn';

/**
 * Botão de agendar sempre à mão no celular, como nas páginas de barbearia dos
 * marketplaces. Só aparece depois que o hero sai da tela: antes disso o botão
 * do topo e o "Agendar agora" já estão visíveis, e três CTAs iguais competindo
 * pelo mesmo espaço viram ruído.
 */
export function StickyBookingBar({ href }: { href: string }) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const onScroll = () => setVisible(window.scrollY > 520);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <div
      aria-hidden={!visible}
      className={cn(
        'fixed inset-x-0 bottom-0 z-30 border-t border-line bg-surface-0/90 px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3 backdrop-blur-md transition-transform duration-300 md:hidden',
        visible ? 'translate-y-0' : 'pointer-events-none translate-y-full',
      )}
    >
      <Link
        href={href}
        tabIndex={visible ? undefined : -1}
        className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-brand-500 font-display text-base font-bold text-surface-0 transition-colors hover:bg-brand-400"
      >
        <CalendarCheck className="h-5 w-5" aria-hidden="true" />
        Agendar horário
      </Link>
    </div>
  );
}
