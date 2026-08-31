'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { LogOut, Menu, Scissors, X } from 'lucide-react';
import { cn } from '@/lib/cn';
import { clearSession } from '@/lib/api';

export interface NavItem {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}

/**
 * Header único do produto. Antes ele existia reescrito em seis telas, cada
 * uma com pequenas divergências de espaçamento e de comportamento no celular
 * — onde os cinco botões do painel quebravam em duas linhas apertadas.
 */
export function AppHeader({
  area,
  subtitle,
  items,
  loginPath = '/login',
}: {
  area: string;
  subtitle?: string;
  items: NavItem[];
  loginPath?: string;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [menuOpen, setMenuOpen] = useState(false);

  const handleLogout = () => {
    clearSession();
    router.push(loginPath);
  };

  return (
    <>
      <header className="sticky top-0 z-40 border-b border-line bg-surface-0/90 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
          <div className="flex min-w-0 items-center gap-3">
            <span
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-brand-500 font-display text-sm font-black text-surface-0"
              aria-hidden="true"
            >
              GB
            </span>
            <div className="min-w-0">
              <p className="truncate text-sm font-bold leading-tight text-ink">
                {area}
              </p>
              {subtitle && (
                <p className="truncate text-xs text-ink-subtle">{subtitle}</p>
              )}
            </div>
          </div>

          {/* Navegação completa no desktop. */}
          <nav className="hidden items-center gap-1 md:flex">
            {items.map((item) => (
              <NavLink
                key={item.href}
                item={item}
                active={isActive(pathname, item.href)}
              />
            ))}
            <button
              type="button"
              onClick={handleLogout}
              className="ml-2 flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold text-ink-muted transition-colors hover:bg-surface-2 hover:text-danger"
            >
              <LogOut className="h-4 w-4" aria-hidden="true" />
              Sair
            </button>
          </nav>

          {/* No celular vira um botão só; o resto abre em painel lateral. */}
          <button
            type="button"
            onClick={() => setMenuOpen(true)}
            aria-label="Abrir menu"
            aria-expanded={menuOpen}
            className="rounded-lg p-2 text-ink-muted transition-colors hover:bg-surface-2 hover:text-ink md:hidden"
          >
            <Menu className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>
      </header>

      {menuOpen && (
        <MobileMenu
          items={items}
          pathname={pathname}
          onClose={() => setMenuOpen(false)}
          onLogout={handleLogout}
        />
      )}
    </>
  );
}

function NavLink({ item, active }: { item: NavItem; active: boolean }) {
  const Icon = item.icon;
  return (
    <Link
      href={item.href}
      aria-current={active ? 'page' : undefined}
      className={cn(
        'flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold transition-colors',
        active
          ? 'bg-brand-500/12 text-brand-400'
          : 'text-ink-muted hover:bg-surface-2 hover:text-ink',
      )}
    >
      <Icon className="h-4 w-4" aria-hidden="true" />
      {item.label}
    </Link>
  );
}

function MobileMenu({
  items,
  pathname,
  onClose,
  onLogout,
}: {
  items: NavItem[];
  pathname: string;
  onClose: () => void;
  onLogout: () => void;
}) {
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKeyDown);
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = previous;
    };
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm md:hidden"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <nav
        aria-label="Menu principal"
        className="ml-auto flex h-full w-72 max-w-[85vw] flex-col border-l border-line bg-surface-1"
      >
        <div className="flex items-center justify-between border-b border-line px-4 py-4">
          <span className="flex items-center gap-2 font-display text-sm font-bold text-ink">
            <Scissors className="h-4 w-4 text-brand-500" aria-hidden="true" />
            Menu
          </span>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar menu"
            autoFocus
            className="rounded-lg p-2 text-ink-subtle transition-colors hover:bg-surface-2 hover:text-ink"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-3">
          <ul className="space-y-1">
            {items.map((item) => {
              const Icon = item.icon;
              const active = isActive(pathname, item.href);
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    onClick={onClose}
                    aria-current={active ? 'page' : undefined}
                    className={cn(
                      'flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-semibold transition-colors',
                      active
                        ? 'bg-brand-500/12 text-brand-400'
                        : 'text-ink-muted hover:bg-surface-2 hover:text-ink',
                    )}
                  >
                    <Icon className="h-5 w-5" aria-hidden="true" />
                    {item.label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>

        <div className="border-t border-line p-3">
          <button
            type="button"
            onClick={onLogout}
            className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-sm font-semibold text-ink-muted transition-colors hover:bg-surface-2 hover:text-danger"
          >
            <LogOut className="h-5 w-5" aria-hidden="true" />
            Sair
          </button>
        </div>
      </nav>
    </div>
  );
}

function isActive(pathname: string, href: string): boolean {
  return pathname === href;
}

/** Cabeçalho de conteúdo, logo abaixo do header. */
export function PageHeading({
  title,
  description,
  actions,
}: {
  title: string;
  description?: string;
  actions?: React.ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h1 className="font-display text-2xl font-extrabold tracking-tight text-ink sm:text-3xl">
          {title}
        </h1>
        {description && (
          <p className="mt-1 text-sm text-ink-muted">{description}</p>
        )}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}
