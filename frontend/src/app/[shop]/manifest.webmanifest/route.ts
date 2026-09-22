import { fetchShop } from '@/lib/server-api';

/**
 * Manifesto por barbearia: quem adiciona a página à tela inicial instala o
 * app com o nome dela, abrindo direto na vitrine dela — e não na página
 * geral da plataforma.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ shop: string }> },
) {
  const { shop: slug } = await params;
  const shop = await fetchShop(slug);
  if (!shop) return new Response('Barbearia não encontrada.', { status: 404 });

  return Response.json(
    {
      name: shop.name,
      short_name: shop.name.length > 12 ? shop.name.split(' ')[0] : shop.name,
      description: shop.about ?? `Agende seu horário na ${shop.name}.`,
      id: `/${shop.slug}`,
      start_url: `/${shop.slug}`,
      scope: `/${shop.slug}`,
      display: 'standalone',
      orientation: 'portrait',
      background_color: '#0a0a0b',
      theme_color: '#0a0a0b',
      lang: 'pt-BR',
      icons: [
        { src: '/icon', sizes: '32x32', type: 'image/png' },
        { src: '/apple-icon', sizes: '180x180', type: 'image/png' },
      ],
    },
    { headers: { 'Content-Type': 'application/manifest+json' } },
  );
}
