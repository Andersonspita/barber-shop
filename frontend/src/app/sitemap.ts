import type { MetadataRoute } from 'next';
import { DirectoryShop, serverFetch } from '@/lib/server-api';

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000';

/** A raiz da plataforma e a vitrine de cada barbearia ativa. */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const shops = await serverFetch<DirectoryShop[]>('/shops', [], {
    revalidate: 3600,
  });

  return [
    {
      url: siteUrl,
      lastModified: new Date(),
      changeFrequency: 'weekly',
      priority: 0.5,
    },
    ...shops.map((shop) => ({
      url: `${siteUrl}/${shop.slug}`,
      lastModified: new Date(),
      changeFrequency: 'weekly' as const,
      priority: 1,
    })),
  ];
}
