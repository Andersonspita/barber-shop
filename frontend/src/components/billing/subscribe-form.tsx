'use client';

import React, { useState } from 'react';
import { CreditCard } from 'lucide-react';
import { ApiError, api } from '@/lib/api';
import { formatBRL } from '@/lib/format';
import { cn } from '@/lib/cn';
import { Button } from '@/components/ui/button';
import { Card, CardBody, CardHeader } from '@/components/ui/card';
import { Field, Input, Select } from '@/components/ui/field';
import { useToast } from '@/components/ui/toast';
import {
  METHOD_LABELS,
  type BillingMethod,
  type BillingStatus,
  type PlanCode,
} from './types';

/**
 * Escolha de plano e forma de pagamento. O CPF/CNPJ vai direto para o Asaas
 * (emissor da cobrança) e não fica guardado na plataforma.
 */
export function SubscribeForm({
  billing,
  onSubscribed,
}: {
  billing: BillingStatus;
  onSubscribed: () => void;
}) {
  const toast = useToast();
  const [plan, setPlan] = useState<PlanCode>(
    billing.pendingPlan ?? billing.plan ?? 'SOLO',
  );
  const [method, setMethod] = useState<BillingMethod>(
    billing.billingMethod ?? 'PIX',
  );
  const [cpfCnpj, setCpfCnpj] = useState('');
  const [saving, setSaving] = useState(false);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setSaving(true);
    try {
      const result = await api<{ invoiceUrl: string | null }>(
        '/admin/billing/subscribe',
        { method: 'POST', auth: true, body: { plan, method, cpfCnpj } },
      );
      toast.success(
        'Assinatura criada',
        'Pague a primeira fatura e o plano é ativado na hora.',
      );
      if (result.invoiceUrl) {
        window.open(result.invoiceUrl, '_blank', 'noopener,noreferrer');
      }
      onSubscribed();
    } catch (caught) {
      toast.error(
        'Não foi possível assinar',
        caught instanceof ApiError ? caught.message : undefined,
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card>
      <CardHeader
        title={billing.hasSubscription ? 'Trocar plano' : 'Assinar'}
        description="Mensalidade sem fidelidade. Pague por Pix, boleto ou cartão."
      />
      <CardBody>
        <form className="space-y-5" onSubmit={submit}>
          <div
            role="radiogroup"
            aria-label="Plano"
            className="grid gap-3 sm:grid-cols-2"
          >
            {billing.plans.map((option) => (
              <button
                key={option.code}
                type="button"
                role="radio"
                aria-checked={plan === option.code}
                onClick={() => setPlan(option.code)}
                className={cn(
                  'rounded-card border p-4 text-left transition-colors',
                  plan === option.code
                    ? 'border-brand-500 bg-brand-500/10'
                    : 'border-line hover:border-line-strong',
                )}
              >
                <span className="block font-display font-bold text-ink">
                  {option.name}
                </span>
                <span className="text-sm text-ink-muted">
                  {formatBRL(option.price)}/mês
                </span>
              </button>
            ))}
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Forma de pagamento">
              {(props) => (
                <Select
                  {...props}
                  value={method}
                  onChange={(e) => setMethod(e.target.value as BillingMethod)}
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
            <Field label="CPF ou CNPJ do titular" hint="Exigido para emitir a cobrança">
              {(props) => (
                <Input
                  {...props}
                  inputMode="numeric"
                  value={cpfCnpj}
                  onChange={(e) => setCpfCnpj(e.target.value)}
                  placeholder="000.000.000-00"
                  required
                />
              )}
            </Field>
          </div>

          <Button type="submit" disabled={saving || !cpfCnpj.trim()}>
            <CreditCard className="h-4 w-4" aria-hidden="true" />
            {saving ? 'Gerando cobrança…' : 'Assinar e pagar'}
          </Button>
        </form>
      </CardBody>
    </Card>
  );
}
