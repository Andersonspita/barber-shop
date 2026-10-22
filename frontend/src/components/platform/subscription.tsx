'use client';

import React, { useState } from 'react';
import { BadgeCheck } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Field, Select } from '@/components/ui/field';
import { formatDateTime } from '@/lib/format';

export type SubscriptionStatus = 'TRIAL' | 'ACTIVE' | 'EXPIRED';
export type PlanCode = 'SOLO' | 'SQUAD' | 'PRO' | 'EMPIRE';

export const PLAN_LABELS: Record<PlanCode, string> = {
  SOLO: 'Solo (1 cadeira)',
  SQUAD: 'Squad (2–4)',
  PRO: 'Pro (5–9)',
  EMPIRE: 'Empire (10+)',
};

interface SubscriptionInfo {
  subscriptionStatus: SubscriptionStatus;
  plan: PlanCode | null;
  trialEndsAt: string | null;
  externalLeadId: string | null;
}

/** Situação comercial: teste grátis (com prazo), vencido ou plano ativo. */
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
      {shop.subscriptionStatus === 'ACTIVE' && shop.plan && (
        <Badge tone="brand">Plano {PLAN_LABELS[shop.plan]}</Badge>
      )}
      {shop.externalLeadId && <Badge>Veio do SDR-AI</Badge>}
    </>
  );
}

/**
 * Conversão manual: enquanto não há cobrança automática, quem opera a
 * plataforma ativa o plano depois de receber o pagamento. Ativar devolve a
 * barbearia ao ar e avisa o SDR-AI.
 */
export function ActivatePlanForm({
  shop,
  onActivate,
}: {
  shop: SubscriptionInfo;
  onActivate: (plan: PlanCode) => Promise<boolean>;
}) {
  const [plan, setPlan] = useState<PlanCode>(shop.plan ?? 'SOLO');
  const [saving, setSaving] = useState(false);

  if (shop.subscriptionStatus === 'ACTIVE') return null;

  return (
    <form
      className="flex items-end gap-2"
      onSubmit={async (event) => {
        event.preventDefault();
        setSaving(true);
        await onActivate(plan);
        setSaving(false);
      }}
    >
      <div className="w-40">
        <Field label="Plano" hint="Após o pagamento">
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
      <Button
        type="submit"
        variant="success"
        size="sm"
        disabled={saving}
        className="mb-[22px] h-10"
      >
        <BadgeCheck className="h-4 w-4" aria-hidden="true" />
        Ativar plano
      </Button>
    </form>
  );
}
