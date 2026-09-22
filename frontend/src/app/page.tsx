import Link from 'next/link';
import { ArrowRight, MapPin, Scissors } from 'lucide-react';
import { DirectoryShop, serverFetch } from '@/lib/server-api';
import { initials } from '@/lib/format';

export const revalidate = 300;

/**
 * Página inicial da plataforma: o diretório das barbearias atendidas.
 *
 * Cada barbearia tem a própria vitrine em `/<slug>` — é esse o link que ela
 * divulga no Instagram e no Google. Quem chega pela raiz escolhe aqui.
 */
export default async function DirectoryPage() {
  const shops = await serverFetch<DirectoryShop[]>('/shops', []);

  return (
    <main id="conteudo" className="flex-1 px-4 pb-20 pt-16 sm:px-6 md:pt-24">
      <div className="mx-auto max-w-4xl">
        <div className="relative mb-12 text-center">
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-x-0 -top-24 h-64 bg-[radial-gradient(ellipse_60%_50%_at_50%_0%,rgba(245,158,11,0.13),transparent)]"
          />
          <p className="relative mb-5 inline-flex items-center gap-2 rounded-full border border-brand-500/30 bg-brand-500/10 px-3.5 py-1.5 text-xs font-bold uppercase tracking-widest text-brand-400">
            <Scissors className="h-3.5 w-3.5" aria-hidden="true" />
            Gerente Barber
          </p>
          <h1 className="relative font-display text-4xl font-black leading-[1.05] tracking-tight text-ink text-balance sm:text-5xl">
            Escolha sua barbearia
          </h1>
          <p className="relative mx-auto mt-4 max-w-xl text-lg text-ink-muted">
            Agende corte e barba em poucos toques, com confirmação e lembrete
            no WhatsApp.
          </p>
        </div>

        {shops.length === 0 ? (
          <p className="rounded-card border border-dashed border-line-strong px-6 py-12 text-center text-sm text-ink-muted">
            Nenhuma barbearia disponível no momento.
          </p>
        ) : (
          <ul className="grid gap-4 sm:grid-cols-2">
            {shops.map((shop) => (
              <li key={shop.slug}>
                <Link
                  href={`/${shop.slug}`}
                  className="group flex h-full items-start gap-4 rounded-card border border-line bg-surface-1 p-5 transition-colors hover:border-brand-500/50 hover:bg-surface-2"
                >
                  <span
                    className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-brand-500 font-display text-base font-black text-surface-0"
                    aria-hidden="true"
                  >
                    {initials(shop.name)}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block font-display text-lg font-bold text-ink transition-colors group-hover:text-brand-400">
                      {shop.name}
                    </span>
                    {shop.city && (
                      <span className="mt-0.5 flex items-center gap-1 text-sm text-ink-subtle">
                        <MapPin className="h-3.5 w-3.5" aria-hidden="true" />
                        {shop.city}
                      </span>
                    )}
                    {shop.about && (
                      <span className="mt-2 line-clamp-2 block text-sm leading-relaxed text-ink-muted">
                        {shop.about}
                      </span>
                    )}
                  </span>
                  <ArrowRight
                    className="mt-1 h-5 w-5 shrink-0 text-ink-subtle transition-colors group-hover:text-brand-400"
                    aria-hidden="true"
                  />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </main>
  );
}
