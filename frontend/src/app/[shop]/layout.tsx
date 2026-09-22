import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { fetchShop } from '@/lib/server-api';
import { ShopProvider } from '@/lib/shop-context';

type Params = Promise<{ shop: string }>;

/**
 * Tudo abaixo de `/<slug>` é de uma barbearia só: vitrine, agendamento,
 * login e painel. O slug que não existe (ou de uma barbearia suspensa) cai
 * no 404 aqui, antes de qualquer tela tentar buscar dados.
 */
export default async function ShopLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Params;
}) {
  const { shop: slug } = await params;
  const shop = await fetchShop(slug);
  if (!shop) notFound();

  return (
    <ShopProvider shop={{ slug: shop.slug, name: shop.name }}>
      {children}
    </ShopProvider>
  );
}

export async function generateMetadata({
  params,
}: {
  params: Params;
}): Promise<Metadata> {
  const { shop: slug } = await params;
  const shop = await fetchShop(slug);
  if (!shop) return { title: 'Barbearia não encontrada' };

  const description =
    shop.about ??
    `Agende corte e barba na ${shop.name} em poucos toques. Escolha o profissional, o horário e receba a confirmação no WhatsApp.`;

  return {
    // `absolute`: o template da raiz ("… · Gerente Barber") é da plataforma
    // e não deve colar no título de cada barbearia.
    title: {
      absolute: `${shop.name} — agende seu horário`,
      template: `%s · ${shop.name}`,
    },
    description,
    applicationName: shop.name,
    manifest: `/${shop.slug}/manifest.webmanifest`,
    alternates: { canonical: `/${shop.slug}` },
    openGraph: {
      type: 'website',
      locale: 'pt_BR',
      siteName: shop.name,
      title: `${shop.name} — agende seu horário`,
      description,
      url: `/${shop.slug}`,
    },
  };
}
