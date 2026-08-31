import type { MetadataRoute } from 'next';

/**
 * Torna o app instalável: o cliente adiciona a barbearia à tela inicial e o
 * barbeiro abre o painel como aplicativo, sem a barra do navegador.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Gerente Barber',
    short_name: 'Gerente Barber',
    description: 'Agende corte e barba com hora marcada.',
    start_url: '/',
    display: 'standalone',
    orientation: 'portrait',
    background_color: '#0a0a0b',
    theme_color: '#0a0a0b',
    lang: 'pt-BR',
    icons: [
      { src: '/icon', sizes: '32x32', type: 'image/png' },
      { src: '/apple-icon', sizes: '180x180', type: 'image/png' },
    ],
  };
}
