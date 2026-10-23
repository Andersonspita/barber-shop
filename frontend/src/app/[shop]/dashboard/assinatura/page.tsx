'use client';

import React, { useCallback } from 'react';
import { CreditCard } from 'lucide-react';
import { api } from '@/lib/api';
import { useSession } from '@/lib/use-session';
import { useAsyncData } from '@/lib/use-async-data';
import { ADMIN_NAV } from '@/lib/nav';
import { AppHeader, PageHeading } from '@/components/app-header';
import { EmptyState } from '@/components/ui/empty-state';
import { SkeletonList } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { BillingStatusCard } from '@/components/billing/billing-status-card';
import { SubscribeForm } from '@/components/billing/subscribe-form';
import type { BillingStatus } from '@/components/billing/types';

/** Assinatura do Gerente Barber: situação, fatura em aberto e escolha de plano. */
export default function SubscriptionPage() {
  const { user, ready } = useSession('ADMIN');

  const fetchBilling = useCallback(
    () => api<BillingStatus>('/admin/billing', { auth: true }),
    [],
  );
  const { data: billing, loading, error, reload } = useAsyncData(fetchBilling);

  if (!ready || !user) return null;

  // Com a assinatura em dia (ou só esperando o pagamento), não há o que escolher.
  const canSubscribe =
    billing &&
    billing.enabled &&
    !['ACTIVE', 'PAST_DUE', 'SUSPENDED'].includes(billing.subscriptionStatus);

  return (
    <>
      <AppHeader
        area="Painel"
        subtitle="Assinatura"
        items={ADMIN_NAV}
        loginPath="/login?area=profissional"
      />
      <main
        id="conteudo"
        className="mx-auto w-full max-w-3xl px-4 py-8 sm:px-6"
      >
        <PageHeading
          title="Assinatura"
          description="Seu plano do Gerente Barber e as faturas."
        />

        {loading && <SkeletonList count={2} className="h-32" />}
        {error && !loading && (
          <EmptyState
            icon={<CreditCard className="h-6 w-6" />}
            title="Não foi possível carregar a assinatura"
            description={error.message}
            action={
              <Button variant="secondary" onClick={reload}>
                Tentar de novo
              </Button>
            }
          />
        )}
        {billing && !loading && (
          <>
            <BillingStatusCard billing={billing} />
            {!billing.enabled && (
              <EmptyState
                icon={<CreditCard className="h-6 w-6" />}
                title="Pagamento online em breve"
                description="Para assinar agora, fale com o suporte do Gerente Barber pelo WhatsApp."
              />
            )}
            {canSubscribe && (
              <SubscribeForm billing={billing} onSubscribed={reload} />
            )}
          </>
        )}
      </main>
    </>
  );
}
