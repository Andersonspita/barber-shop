import React from 'react';
import { ExternalLink } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Card, CardBody, CardHeader } from '@/components/ui/card';
import { formatBRL, formatDateTime } from '@/lib/format';
import type { BillingStatus, SubscriptionStatus } from './types';

const STATUS: Record<
  SubscriptionStatus,
  { label: string; tone: 'success' | 'warning' | 'danger' | 'brand' }
> = {
  TRIAL: { label: 'Teste grátis', tone: 'warning' },
  ACTIVE: { label: 'Em dia', tone: 'success' },
  PAST_DUE: { label: 'Mensalidade vencida', tone: 'danger' },
  SUSPENDED: { label: 'Suspensa por falta de pagamento', tone: 'danger' },
  EXPIRED: { label: 'Teste encerrado', tone: 'danger' },
};

/** Situação da assinatura e, quando houver, o link da fatura em aberto. */
export function BillingStatusCard({ billing }: { billing: BillingStatus }) {
  const status = STATUS[billing.subscriptionStatus];
  // O plano escolhido na assinatura vale mais que o do teste até ser pago.
  const planCode = billing.pendingPlan ?? billing.plan;
  const plan = billing.plans.find((p) => p.code === planCode);

  return (
    <Card className="mb-6">
      <CardHeader
        title="Sua assinatura"
        actions={<Badge tone={status.tone}>{status.label}</Badge>}
      />
      <CardBody className="space-y-2 text-sm text-ink-muted">
        {plan && (
          <p>
            Plano <strong className="text-ink">{plan.name}</strong> ·{' '}
            {formatBRL(plan.price)}/mês
            {billing.pendingPlan && ' (ativa quando a 1ª fatura for paga)'}
          </p>
        )}
        {billing.subscriptionStatus === 'TRIAL' && billing.trialEndsAt && (
          <p>
            O teste grátis vai até{' '}
            <strong className="text-ink">
              {formatDateTime(billing.trialEndsAt)}
            </strong>
            . Assine antes para a página não sair do ar.
          </p>
        )}
        {billing.subscriptionStatus === 'PAST_DUE' && billing.suspendsAt && (
          <p className="text-danger">
            Sem o pagamento, a página sai do ar em{' '}
            {formatDateTime(billing.suspendsAt)}.
          </p>
        )}
        {billing.invoiceUrl && (
          <a
            href={billing.invoiceUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex h-11 items-center gap-2 rounded-xl bg-brand-500 px-4 text-sm font-bold text-surface-0 hover:bg-brand-400"
          >
            Pagar fatura em aberto
            <ExternalLink className="h-4 w-4" aria-hidden="true" />
          </a>
        )}
      </CardBody>
    </Card>
  );
}
