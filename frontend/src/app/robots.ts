import type { MetadataRoute } from 'next';

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      // As áreas logadas não têm nada a fazer no índice de busca.
      // Agora em /<slug>/..., uma por barbearia.
      disallow: ['/*/dashboard', '/*/reservas', '/*/login', '/plataforma'],
    },
    sitemap: `${siteUrl}/sitemap.xml`,
  };
}
