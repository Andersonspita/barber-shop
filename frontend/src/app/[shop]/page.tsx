import Link from 'next/link';
import {
  AtSign,
  Clock,
  MapPin,
  MessageCircle,
  Phone,
  Scissors,
  Star,
  UserRound,
} from 'lucide-react';
import { notFound } from 'next/navigation';
import {
  PublicBarber,
  PublicService,
  PublicShop,
  fetchShop,
  serverFetch,
} from '@/lib/server-api';
import { shopHref } from '@/lib/shop-href';
import { formatBRLCompact, formatDuration, formatPhone } from '@/lib/format';
import { LandingHeader } from '@/components/landing/landing-header';
import { StickyBookingBar } from '@/components/landing/sticky-booking-bar';
import { Avatar } from '@/components/ui/avatar';

// Server Component: o HTML já sai com serviços e equipe dentro, revalidado a
// cada 5 minutos. A versão anterior era client-side e entregava página vazia
// ao buscador.
export const revalidate = 300;

export default async function LandingPage({
  params,
}: {
  params: Promise<{ shop: string }>;
}) {
  const { shop: slug } = await params;
  const [services, barbers, shop] = await Promise.all([
    serverFetch<PublicService[]>('/services', [], { shop: slug }),
    serverFetch<PublicBarber[]>('/barbers', [], { shop: slug }),
    fetchShop(slug),
  ]);
  if (!shop) notFound();

  const href = (path: string) => shopHref(shop.slug, path);

  const whatsappLink = shop.whatsapp
    ? `https://wa.me/${shop.whatsapp.replace(/\D/g, '')}`
    : null;

  const rating = aggregateRating(barbers);
  const startingPrice = services.length
    ? Math.min(...services.map((service) => Number(service.price)))
    : null;

  return (
    <>
      <LandingHeader shopName={shop.name} basePath={href('/')} />
      <StructuredData shop={shop} services={services} rating={rating} />

      <main id="conteudo" className="pt-18">
        {/* -------------------------------------------------------- hero */}
        <section className="relative overflow-hidden px-4 pb-20 pt-20 sm:px-6 md:pb-28 md:pt-28">
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_60%_50%_at_50%_0%,rgba(245,158,11,0.13),transparent)]"
          />
          <div className="relative mx-auto max-w-3xl text-center">
            <p className="mb-5 inline-flex items-center gap-2 rounded-full border border-brand-500/30 bg-brand-500/10 px-3.5 py-1.5 text-xs font-bold uppercase tracking-widest text-brand-400">
              <Scissors className="h-3.5 w-3.5" aria-hidden="true" />
              {shop.city ?? 'Corte e barba com hora marcada'}
            </p>

            <h1 className="font-display text-4xl font-black leading-[1.05] tracking-tight text-ink text-balance sm:text-5xl md:text-6xl">
              Seu horário na cadeira,{' '}
              <span className="text-brand-400">sem fila e sem espera.</span>
            </h1>

            <p className="mx-auto mt-6 max-w-xl text-lg leading-relaxed text-ink-muted">
              {shop.about ??
                'Escolha o serviço, o profissional e o horário. Você recebe a confirmação no WhatsApp e um lembrete antes de sair de casa.'}
            </p>

            <div className="mt-9 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <Link
                href={href('/reservas/nova')}
                className="w-full rounded-2xl bg-brand-500 px-8 py-4 font-display text-base font-bold text-surface-0 transition-colors hover:bg-brand-400 sm:w-auto"
              >
                Agendar agora
              </Link>
              <a
                href="#servicos"
                className="w-full rounded-2xl border border-line-strong bg-surface-1 px-8 py-4 font-display text-base font-bold text-ink transition-colors hover:bg-surface-2 sm:w-auto"
              >
                Ver serviços e preços
              </a>
            </div>

            {/* Prova social logo abaixo do botão, como nas páginas de
                estabelecimento do Booksy e do Fresha. */}
            <ul className="mt-8 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-sm text-ink-muted">
              {rating && (
                <li className="flex items-center gap-1.5">
                  <Star
                    className="h-4 w-4 fill-current text-brand-400"
                    aria-hidden="true"
                  />
                  <span className="font-bold tabular text-ink">
                    {rating.value.toFixed(1).replace('.', ',')}
                  </span>
                  <span className="tabular">
                    ({rating.count}{' '}
                    {rating.count === 1 ? 'avaliação' : 'avaliações'})
                  </span>
                </li>
              )}
              {startingPrice !== null && (
                <li>
                  Serviços a partir de{' '}
                  <span className="font-bold tabular text-ink">
                    {formatBRLCompact(startingPrice)}
                  </span>
                </li>
              )}
              {shop.cancellationWindowMinutes > 0 && (
                <li>
                  Cancelamento grátis até{' '}
                  {Math.round(shop.cancellationWindowMinutes / 60)}h antes
                </li>
              )}
            </ul>
          </div>
        </section>

        {/* ----------------------------------------------- como funciona */}
        <section
          aria-labelledby="como-funciona"
          className="border-t border-line px-4 py-16 sm:px-6"
        >
          <div className="mx-auto max-w-6xl">
            <h2 id="como-funciona" className="sr-only">
              Como funciona
            </h2>
            <ol className="grid gap-4 sm:grid-cols-3">
              {HOW_IT_WORKS.map((step, index) => (
                <li
                  key={step.title}
                  className="flex items-start gap-4 rounded-card border border-line bg-surface-1 p-5"
                >
                  <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-brand-500/12 text-brand-400">
                    <step.icon className="h-5 w-5" aria-hidden="true" />
                  </span>
                  <div>
                    <p className="text-xs font-bold uppercase tracking-widest text-ink-subtle">
                      Passo {index + 1}
                    </p>
                    <h3 className="mt-0.5 font-display text-base font-bold text-ink">
                      {step.title}
                    </h3>
                    <p className="mt-1 text-sm leading-relaxed text-ink-muted">
                      {step.description}
                    </p>
                  </div>
                </li>
              ))}
            </ol>
          </div>
        </section>

        {/* ---------------------------------------------------- serviços */}
        <section
          id="servicos"
          className="scroll-mt-24 border-t border-line px-4 py-20 sm:px-6"
        >
          <div className="mx-auto max-w-6xl">
            <SectionHeading
              eyebrow="Serviços"
              title="O que fazemos"
              description="Preço e duração fechados, sem surpresa no caixa."
            />

            {services.length === 0 ? (
              <p className="rounded-card border border-dashed border-line-strong px-6 py-12 text-center text-sm text-ink-muted">
                Os serviços aparecem aqui assim que forem cadastrados no painel.
              </p>
            ) : (
              <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {services.map((service) => (
                  <li key={service.id}>
                    <Link
                      href={href(`/reservas/nova?serviceId=${service.id}`)}
                      className="group flex h-full flex-col rounded-card border border-line bg-surface-1 p-6 transition-colors hover:border-brand-500/50 hover:bg-surface-2"
                    >
                      <div className="mb-3 flex items-start justify-between gap-4">
                        <h3 className="font-display text-lg font-bold text-ink transition-colors group-hover:text-brand-400">
                          {service.name}
                        </h3>
                        <span className="shrink-0 font-display text-xl font-extrabold tabular text-brand-400">
                          {formatBRLCompact(service.price)}
                        </span>
                      </div>

                      {/* Descrição própria de cada serviço. Antes, todos os
                          cards repetiam a mesma frase sobre "lavagem e
                          finalização premium" — inclusive o de barba. */}
                      {service.description && (
                        <p className="mb-5 text-sm leading-relaxed text-ink-muted">
                          {service.description}
                        </p>
                      )}

                      <p className="mt-auto flex items-center gap-1.5 text-xs font-semibold text-ink-subtle">
                        <Clock className="h-3.5 w-3.5" aria-hidden="true" />
                        {formatDuration(service.durationMinutes)}
                      </p>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>

        {/* ------------------------------------------------------- equipe */}
        <section
          id="equipe"
          className="scroll-mt-24 border-t border-line bg-surface-1/40 px-4 py-20 sm:px-6"
        >
          <div className="mx-auto max-w-6xl">
            <SectionHeading
              eyebrow="Equipe"
              title="Quem vai te atender"
              description="Escolha seu profissional na hora de agendar, ou deixe com quem estiver livre."
            />

            {barbers.length === 0 ? (
              <p className="rounded-card border border-dashed border-line-strong px-6 py-12 text-center text-sm text-ink-muted">
                A equipe aparece aqui assim que for cadastrada no painel.
              </p>
            ) : (
              <ul className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
                {barbers.map((barber) => (
                  <li
                    key={barber.id}
                    className="overflow-hidden rounded-card border border-line bg-surface-1"
                  >
                    <div className="relative aspect-[4/5] bg-surface-2">
                      {/* Sem foto cadastrada, mostra as iniciais. A versão
                          anterior puxava retratos de estranhos do pravatar. */}
                      <Avatar
                        name={barber.name}
                        photoUrl={barber.photoUrl}
                        size="xl"
                      />
                    </div>
                    <div className="p-5">
                      <div className="flex items-baseline justify-between gap-3">
                        <h3 className="font-display text-lg font-bold text-ink">
                          {barber.name}
                        </h3>
                        {barber.rating !== null && (
                          <span className="flex shrink-0 items-center gap-1 text-sm font-bold tabular text-brand-400">
                            <Star
                              className="h-3.5 w-3.5 fill-current"
                              aria-hidden="true"
                            />
                            {barber.rating.toFixed(1)}
                            <span className="sr-only">
                              de 5, em {barber.reviewCount} avaliações
                            </span>
                          </span>
                        )}
                      </div>
                      {barber.bio && (
                        <p className="mt-2 text-sm leading-relaxed text-ink-muted">
                          {barber.bio}
                        </p>
                      )}
                      <Link
                        href={href(`/reservas/nova?barberId=${barber.id}`)}
                        className="mt-4 inline-block text-sm font-bold text-brand-400 transition-colors hover:text-brand-300"
                      >
                        Agendar com {barber.name.split(' ')[0]} →
                      </Link>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>

        {/* ------------------------------------------------------- visita */}
        <section
          id="visite"
          className="scroll-mt-24 border-t border-line px-4 py-20 sm:px-6"
        >
          <div className="mx-auto max-w-6xl">
            <SectionHeading
              eyebrow="Onde estamos"
              title="Venha nos visitar"
              description="Endereço, telefone e redes sociais para você chegar até a gente."
            />

            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {shop.addressLine && (
                <InfoCard
                  icon={<MapPin className="h-5 w-5" aria-hidden="true" />}
                  title="Endereço"
                  value={[shop.addressLine, shop.city]
                    .filter(Boolean)
                    .join(' — ')}
                  href={shop.mapsUrl ?? undefined}
                  linkLabel="Abrir no mapa"
                />
              )}
              {shop.phone && (
                <InfoCard
                  icon={<Phone className="h-5 w-5" aria-hidden="true" />}
                  title="Telefone"
                  value={formatPhone(shop.phone)}
                  href={`tel:${shop.phone.replace(/\D/g, '')}`}
                  linkLabel="Ligar"
                />
              )}
              {whatsappLink && (
                <InfoCard
                  icon={
                    <MessageCircle className="h-5 w-5" aria-hidden="true" />
                  }
                  title="WhatsApp"
                  value={formatPhone(shop.whatsapp)}
                  href={whatsappLink}
                  linkLabel="Chamar no WhatsApp"
                />
              )}
              {shop.instagram && (
                <InfoCard
                  icon={<AtSign className="h-5 w-5" aria-hidden="true" />}
                  title="Instagram"
                  value={`@${shop.instagram.replace('@', '')}`}
                  href={`https://instagram.com/${shop.instagram.replace('@', '')}`}
                  linkLabel="Ver o perfil"
                />
              )}
            </div>

            {!shop.addressLine && !shop.phone && (
              <p className="rounded-card border border-dashed border-line-strong px-6 py-12 text-center text-sm text-ink-muted">
                Endereço, telefone e redes sociais aparecem aqui depois de
                preenchidos em Ajustes, no painel.
              </p>
            )}
          </div>
        </section>
      </main>

      <StickyBookingBar href={href('/reservas/nova')} />

      <footer className="border-t border-line px-4 pb-28 pt-10 sm:px-6 md:pb-10">
        <div className="mx-auto flex max-w-6xl flex-col items-center gap-4 text-center sm:flex-row sm:justify-between sm:text-left">
          <p className="text-sm text-ink-subtle">
            © {new Date().getFullYear()} {shop.name}. Todos os direitos
            reservados.
          </p>
          {/* Contraste elevado: este link estava em neutral-700 sobre fundo
              quase preto, perto de 2,2:1 — menos da metade do mínimo da AA. */}
          <Link
            href={href('/login?area=profissional')}
            className="text-sm font-semibold text-ink-muted transition-colors hover:text-brand-400"
          >
            Área do profissional
          </Link>
        </div>
      </footer>
    </>
  );
}

const HOW_IT_WORKS = [
  {
    icon: Scissors,
    title: 'Escolha o serviço',
    description: 'Preço e duração à vista, antes de marcar.',
  },
  {
    icon: UserRound,
    title: 'Escolha o profissional',
    description: 'Pelo nome e pela foto — ou deixe com quem estiver livre.',
  },
  {
    icon: MessageCircle,
    title: 'Confirme no WhatsApp',
    description: 'Você recebe a confirmação e um lembrete antes do horário.',
  },
];

/**
 * Nota geral da casa, ponderada pelo número de avaliações de cada barbeiro —
 * uma média simples daria o mesmo peso a quem tem 2 e a quem tem 200.
 */
function aggregateRating(
  barbers: PublicBarber[],
): { value: number; count: number } | null {
  let sum = 0;
  let count = 0;
  for (const barber of barbers) {
    if (barber.rating === null || barber.reviewCount === 0) continue;
    sum += barber.rating * barber.reviewCount;
    count += barber.reviewCount;
  }
  return count > 0 ? { value: sum / count, count } : null;
}

function SectionHeading({
  eyebrow,
  title,
  description,
}: {
  eyebrow: string;
  title: string;
  description: string;
}) {
  return (
    <div className="mb-10 max-w-2xl">
      <p className="mb-3 text-xs font-bold uppercase tracking-widest text-brand-400">
        {eyebrow}
      </p>
      <h2 className="font-display text-3xl font-extrabold tracking-tight text-ink text-balance sm:text-4xl">
        {title}
      </h2>
      <p className="mt-3 text-ink-muted">{description}</p>
    </div>
  );
}

function InfoCard({
  icon,
  title,
  value,
  href,
  linkLabel,
}: {
  icon: React.ReactNode;
  title: string;
  value: string;
  href?: string;
  linkLabel: string;
}) {
  return (
    <div className="rounded-card border border-line bg-surface-1 p-6">
      <span className="mb-4 flex h-10 w-10 items-center justify-center rounded-xl bg-brand-500/12 text-brand-400">
        {icon}
      </span>
      <h3 className="font-display text-base font-bold text-ink">{title}</h3>
      <p className="mt-1 text-sm text-ink-muted">{value}</p>
      {href && (
        <a
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-3 inline-block text-sm font-bold text-brand-400 transition-colors hover:text-brand-300"
        >
          {linkLabel} →
        </a>
      )}
    </div>
  );
}

/**
 * Dados estruturados de negócio local: é o que faz a barbearia aparecer no
 * painel lateral do Google com endereço, telefone e faixa de preço.
 */
function StructuredData({
  shop,
  services,
  rating,
}: {
  shop: PublicShop;
  services: PublicService[];
  rating: { value: number; count: number } | null;
}) {
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'HairSalon',
    name: shop.name,
    description: shop.about ?? undefined,
    telephone: shop.phone ?? undefined,
    address: shop.addressLine
      ? {
          '@type': 'PostalAddress',
          streetAddress: shop.addressLine,
          addressLocality: shop.city ?? undefined,
          addressCountry: 'BR',
        }
      : undefined,
    hasMap: shop.mapsUrl ?? undefined,
    aggregateRating: rating
      ? {
          '@type': 'AggregateRating',
          ratingValue: rating.value.toFixed(1),
          reviewCount: rating.count,
        }
      : undefined,
    sameAs: shop.instagram
      ? [`https://instagram.com/${shop.instagram.replace('@', '')}`]
      : undefined,
    makesOffer: services.map((service) => ({
      '@type': 'Offer',
      itemOffered: { '@type': 'Service', name: service.name },
      price: Number(service.price).toFixed(2),
      priceCurrency: 'BRL',
    })),
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
    />
  );
}
