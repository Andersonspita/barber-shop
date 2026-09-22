'use client';

import { Suspense } from 'react';
import { useSession } from '@/lib/use-session';
import { staffNav } from '@/lib/nav';
import { AppHeader, PageHeading } from '@/components/app-header';
import { AccountSettings } from '@/components/account-settings';

function StaffSettings() {
  const { user, ready } = useSession('STAFF');
  if (!ready || !user) return null;

  return (
    <>
      <AppHeader
        area="Painel"
        subtitle="Minha conta"
        items={staffNav(user.isAdmin)}
        loginPath="/login?area=profissional"
      />
      <main id="conteudo" className="mx-auto w-full max-w-2xl px-4 py-8 sm:px-6">
        <PageHeading
          title="Minha conta"
          description="Seus dados e a segurança do acesso ao painel."
        />
        <AccountSettings />
      </main>
    </>
  );
}

export default function Page() {
  return (
    <Suspense fallback={null}>
      <StaffSettings />
    </Suspense>
  );
}
