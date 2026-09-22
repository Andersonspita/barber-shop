import type { Metadata, Viewport } from 'next';
import { Archivo, Public_Sans } from 'next/font/google';
import './globals.css';
import { ToastProvider } from '@/components/ui/toast';

/**
 * Archivo para títulos e números: pesada e levemente condensada, tem o ar de
 * letreiro esmaltado que combina com barbearia. Public Sans para o corpo.
 *
 * O layout anterior carregava Geist Sans e Geist Mono e nenhuma das duas
 * chegava à tela: o `globals.css` fechava com `font-family: Arial`, e o
 * seletor de elemento vencia. Duas famílias baixadas para nada.
 */
const archivo = Archivo({
  variable: '--font-archivo',
  subsets: ['latin'],
  weight: ['600', '700', '800', '900'],
  display: 'swap',
});

const publicSans = Public_Sans({
  variable: '--font-public-sans',
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  display: 'swap',
});

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000'),
  // Marca da plataforma. Cada barbearia sobrescreve título, descrição e
  // manifesto no próprio layout (`app/[shop]/layout.tsx`).
  title: {
    default: 'Gerente Barber — agendamento online para barbearias',
    template: '%s · Gerente Barber',
  },
  description:
    'Encontre sua barbearia e agende corte e barba em poucos toques, com confirmação e lembrete no WhatsApp.',
  applicationName: 'Gerente Barber',
  manifest: '/manifest.webmanifest',
  openGraph: {
    type: 'website',
    locale: 'pt_BR',
    siteName: 'Gerente Barber',
    title: 'Gerente Barber — agendamento online para barbearias',
    description:
      'Corte, barba e cuidado com hora marcada. Escolha o profissional e garanta seu horário em segundos.',
  },
  robots: { index: true, follow: true },
};

export const viewport: Viewport = {
  themeColor: '#0a0a0b',
  colorScheme: 'dark',
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    // pt-BR: o app é todo em português e estava declarado como inglês, o que
    // fazia o leitor de tela pronunciar tudo com fonética inglesa.
    // `data-scroll-behavior="smooth"`: a partir do Next 16 o roteador não
    // sobrescreve mais o scroll-behavior do CSS durante a navegação. Sem o
    // atributo, trocar de rota rolaria suavemente até o topo em vez de saltar.
    <html
      lang="pt-BR"
      data-scroll-behavior="smooth"
      className={`${archivo.variable} ${publicSans.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <body className="flex min-h-full flex-col bg-surface-0 text-ink">
        <a
          href="#conteudo"
          className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-[70] focus:rounded-lg focus:bg-brand-500 focus:px-4 focus:py-2 focus:text-sm focus:font-bold focus:text-surface-0"
        >
          Pular para o conteúdo
        </a>
        <ToastProvider>{children}</ToastProvider>
      </body>
    </html>
  );
}
