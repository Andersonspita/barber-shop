'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Menu, X } from 'lucide-react';

const LINKS = [
  { href: '#servicos', label: 'Serviços' },
  { href: '#equipe', label: 'Equipe' },
  { href: '#visite', label: 'Onde estamos' },
];

/**
 * A navegação era `hidden md:flex` sem menu alternativo: no celular — onde
 * está quase todo cliente de barbearia — os links simplesmente não existiam.
 */
export function LandingHeader() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    document.addEventListener('keydown', onKeyDown);
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = previous;
    };
  }, [open]);

  return (
    <header className="fixed inset-x-0 top-0 z-40 border-b border-line/60 bg-surface-0/70 backdrop-blur-xl">
      <div className="mx-auto flex h-18 max-w-6xl items-center justify-between px-4 sm:px-6">
        <Link href="/" className="flex items-center gap-3">
          <span
            className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-500 font-display text-base font-black text-surface-0"
            aria-hidden="true"
          >
            GB
          </span>
          <span className="font-display text-lg font-extrabold tracking-tight text-ink">
            Gerente Barber
          </span>
        </Link>

        <nav aria-label="Seções" className="hidden items-center gap-7 md:flex">
          {LINKS.map((link) => (
            <a
              key={link.href}
              href={link.href}
              className="text-sm font-semibold text-ink-muted transition-colors hover:text-ink"
            >
              {link.label}
            </a>
          ))}
        </nav>

        <div className="flex items-center gap-2">
          <Link
            href="/login"
            className="hidden rounded-xl px-4 py-2.5 text-sm font-semibold text-ink-muted transition-colors hover:text-ink sm:block"
          >
            Entrar
          </Link>
          <Link
            href="/reservas/nova"
            className="rounded-xl bg-brand-500 px-4 py-2.5 text-sm font-bold text-surface-0 transition-colors hover:bg-brand-400"
          >
            Agendar
          </Link>
          <button
            type="button"
            onClick={() => setOpen(true)}
            aria-label="Abrir menu"
            aria-expanded={open}
            className="rounded-lg p-2 text-ink-muted transition-colors hover:bg-surface-2 hover:text-ink md:hidden"
          >
            <Menu className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>
      </div>

      {open && (
        <div
          className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm md:hidden"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setOpen(false);
          }}
        >
          <nav
            aria-label="Menu"
            className="ml-auto flex h-full w-72 max-w-[85vw] flex-col border-l border-line bg-surface-1 p-4"
          >
            <div className="mb-4 flex justify-end">
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Fechar menu"
                autoFocus
                className="rounded-lg p-2 text-ink-subtle transition-colors hover:bg-surface-2 hover:text-ink"
              >
                <X className="h-5 w-5" aria-hidden="true" />
              </button>
            </div>

            <ul className="space-y-1">
              {LINKS.map((link) => (
                <li key={link.href}>
                  <a
                    href={link.href}
                    onClick={() => setOpen(false)}
                    className="block rounded-xl px-3 py-3 text-sm font-semibold text-ink-muted transition-colors hover:bg-surface-2 hover:text-ink"
                  >
                    {link.label}
                  </a>
                </li>
              ))}
              <li>
                <Link
                  href="/login"
                  className="block rounded-xl px-3 py-3 text-sm font-semibold text-ink-muted transition-colors hover:bg-surface-2 hover:text-ink"
                >
                  Entrar na minha conta
                </Link>
              </li>
            </ul>

            <Link
              href="/reservas/nova"
              className="mt-auto rounded-xl bg-brand-500 px-4 py-3.5 text-center text-sm font-bold text-surface-0"
            >
              Agendar horário
            </Link>
          </nav>
        </div>
      )}
    </header>
  );
}
