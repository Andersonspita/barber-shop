'use client';

import React, { useState } from 'react';
import { BadgeCheck, ExternalLink, Receipt } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Field, Input, Select } from '@/components/ui/field';
import { formatDateTime } from '@/lib/format';
import {
  METHOD_LABELS,
  type BillingMethod,
  type PlanCode,
  type SubscriptionStatus,
} from '@/components/billing/types';

export type { PlanCode, SubscriptionStatus };

export const PLAN_LABELS: Record<PlanCode, string> = {
  SOLO: 'Solo (1 cadeira)',
  SQUAD: 'Squad (2–4)',
  PRO: 'Pro (5–9)',
  EMPIRE: 'Empire (10+)',
};

interface SubscriptionInfo {
  subscriptionStatus: SubscriptionStatus;
  plan: PlanCode | null;
  pendingPlan: PlanCode | null;
  trialEndsAt: string | null;
  externalLeadId: string | null;
  billingInvoiceUrl: string | null;
  pastDueSince: string | null;
}

/** Situação comercial: teste, plano ativo, inadimplência ou suspensão. */
export function SubscriptionBadge({ shop }: { shop: SubscriptionInfo }) {
  return (
    <>
      {shop.subscriptionStatus === 'TRIAL' && (
        <Badge tone="warning">
          Teste grátis
          {shop.trialEndsAt ? ` até ${formatDateTime(shop.trialEndsAt)}` : ''}
        </Badge>
      )}
      {shop.subscriptionStatus === 'EXPIRED' && (
        <Badge tone="danger">Teste vencido</Badge>
      )}
      {shop.subscriptionStatus === 'PAST_DUE' && (
        <Badge tone="danger">
          Inadimplente
          {shop.pastDueSince ? ` desde ${formatDateTime(shop.pastDueSince)}` : ''}
        </Badge>
      )}
      {shop.subscriptionStatus === 'SUSPENDED' && (
        <Badge tone="danger">Suspensa por falta de pagamento</Badge>
      )}
      {shop.subscriptionStatus === 'ACTIVE' && shop.plan && (
        <Badge tone="brand">Plano {PLAN_LABELS[shop.plan]}</Badge>
      )}
      {shop.pendingPlan && shop.subscriptionStatus !== 'ACTIVE' && (
        <Badge>Aguardando 1º pagamento</Badge>
      )}
      {shop.externalLeadId && <Badge>Veio do SDR-AI</Badge>}
    </>
  );
}

export interface ChargeInput {
  plan: PlanCode;
  method: BillingMethod;
  cpfCnpj: string;
}

/**
 * Cobrança de uma barbearia sem plano ativo. "Gerar cobrança" cria a
 * assinatura no Asaas e manda a fatura no WhatsApp do dono; o plano ativa
 * sozinho quando o pagamento cai. "Ativar sem cobrança" é a saída manual
 * (pagamento combinado por fora).
 */
export function PlanControls({
  shop,
  onCharge,
  onActivate,
}: {
  shop: SubscriptionInfo;
  onCharge: (input: ChargeInput) => Promise<boolean>;
  onActivate: (plan: PlanCode) => Promise<boolean>;
}) {
  const [plan, setPlan] = useState<PlanCode>(
    shop.pendingPlan ?? shop.plan ?? 'SOLO',
  );
  const [method, setMethod] = useState<BillingMethod>('PIX');
  const [cpfCnpj, setCpfCnpj] = useState('');
  const [busy, setBusy] = useState(false);

  if (shop.subscriptionStatus === 'ACTIVE') return null;

  const run = async (action: () => Promise<boolean>) => {
    setBusy(true);
    await action();
    setBusy(false);
  };

  // Inadimplente/suspensa: já existe fatura; o caminho é pagá-la.
  const owesInvoice =
    shop.subscriptionStatus === 'PAST_DUE' ||
    shop.subscriptionStatus === 'SUSPENDED';

  return (
    <div className="flex flex-wrap items-end gap-2">
      {owesInvoice ? (
        shop.billingInvoiceUrl && (
          <a
            href={shop.billingInvoiceUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="mb-[22px] inline-flex h-10 items-center gap-1.5 rounded-xl border border-line-strong bg-surface-2 px-3 text-xs font-semibold text-ink hover:border-brand-500/50"
          >
            Fatura em aberto
            <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
          </a>
        )
      ) : (
        <>
          <div className="w-36">
            <Field label="Plano">
              {(props) => (
                <Select
                  {...props}
                  value={plan}
                  onChange={(e) => setPlan(e.target.value as PlanCode)}
                  className="h-10"
                >
                  {(Object.keys(PLAN_LABELS) as PlanCode[]).map((code) => (
                    <option key={code} value={code}>
                      {PLAN_LABELS[code]}
                    </option>
                  ))}
                </Select>
              )}
            </Field>
          </div>
          <div className="w-32">
            <Field label="Pagamento">
              {(props) => (
                <Select
                  {...props}
                  value={method}
                  onChange={(e) => setMethod(e.target.value as BillingMethod)}
                  className="h-10"
                >
                  {(Object.keys(METHOD_LABELS) as BillingMethod[]).map(
                    (code) => (
                      <option key={code} value={code}>
                        {METHOD_LABELS[code]}
                      </option>
                    ),
                  )}
                </Select>
              )}
            </Field>
          </div>
          <div className="w-40">
            <Field label="CPF/CNPJ do dono">
              {(props) => (
                <Input
                  {...props}
                  inputMode="numeric"
                  value={cpfCnpj}
                  onChange={(e) => setCpfCnpj(e.target.value)}
                  className="h-10"
                />
              )}
            </Field>
          </div>
          <Button
            size="sm"
            disabled={busy || !cpfCnpj.trim()}
            className="mb-[22px] h-10"
            onClick={() => void run(() => onCharge({ plan, method, cpfCnpj }))}
          >
            <Receipt className="h-4 w-4" aria-hidden="true" />
            Gerar cobrança
          </Button>
        </>
      )}
      <Button
        variant="success"
        size="sm"
        disabled={busy}
        className="mb-[22px] h-10"
        onClick={() => void run(() => onActivate(plan))}
        title="Pagamento combinado por fora do Asaas"
      >
        <BadgeCheck className="h-4 w-4" aria-hidden="true" />
        Ativar sem cobrança
      </Button>
    </div>
  );
}
