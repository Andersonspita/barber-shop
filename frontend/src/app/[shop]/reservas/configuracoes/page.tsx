'use client';

import { Suspense } from 'react';
import { useSession } from '@/lib/use-session';
import { CLIENT_NAV } from '@/lib/nav';
import { AppHeader, PageHeading } from '@/components/app-header';
import { AccountSettings } from '@/components/account-settings';

function ClientSettings() {
  const { ready } = useSession('CLIENT');
  if (!ready) return null;

  return (
    <>
      <AppHeader
        area="Portal do cliente"
        subtitle="Minha conta"
        items={CLIENT_NAV}
      />
      <main id="conteudo" className="mx-auto w-full max-w-2xl px-4 py-8 sm:px-6">
        <PageHeading
          title="Minha conta"
          description="Seus dados de contato e a segurança do acesso."
        />
        <AccountSettings />
      </main>
    </>
  );
}

export default function Page() {
  return (
    <Suspense fallback={null}>
      <ClientSettings />
    </Suspense>
  );
}
