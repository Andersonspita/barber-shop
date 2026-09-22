import Link from 'next/link';
import { SearchX } from 'lucide-react';

/**
 * Também é o destino de `/<slug>` que não existe ou de barbearia suspensa: o
 * `notFound()` do layout da barbearia sobe até aqui.
 */
export default function NotFound() {
  return (
    <main
      id="conteudo"
      className="flex min-h-dvh flex-col items-center justify-center px-4 py-16 text-center"
    >
      <span className="mb-5 flex h-16 w-16 items-center justify-center rounded-full bg-surface-2 text-ink-subtle">
        <SearchX className="h-8 w-8" aria-hidden="true" />
      </span>
      <h1 className="font-display text-3xl font-extrabold tracking-tight text-ink">
        Página não encontrada
      </h1>
      <p className="mt-2 max-w-sm text-ink-muted">
        Confira o endereço. Se for o link de uma barbearia, ela pode ter mudado
        de endereço ou não estar mais disponível.
      </p>
      <Link
        href="/"
        className="mt-8 rounded-xl bg-brand-500 px-6 py-3 font-display text-sm font-bold text-surface-0 transition-colors hover:bg-brand-400"
      >
        Ver barbearias
      </Link>
    </main>
  );
}
