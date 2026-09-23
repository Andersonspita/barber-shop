'use client';

import React, { useCallback, useState } from 'react';
import { AlertTriangle, Check, CreditCard, Receipt, Users } from 'lucide-react';
import { ApiError, api } from '@/lib/api';
import { useSession } from '@/lib/use-session';
import { useAsyncData } from '@/lib/use-async-data';
import { ADMIN_NAV } from '@/lib/nav';
import { formatBRL, formatDate } from '@/lib/format';
import {
  BILLING_STATUS,
  BillingSummary,
  INVOICE_STATUS,
  PlanView,
  planCapacity,
} from '@/lib/billing';
import { AppHeader, PageHeading } from '@/components/app-header';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardBody, CardHeader } from '@/components/ui/card';
import { ConfirmDialog } from '@/components/ui/modal';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/components/ui/toast';
import { cn } from '@/lib/cn';

/**
 * Assinatura da barbearia: plano, profissionais em uso, fatura em aberto e
 * histórico. O pagamento ainda é feito por fora (Pix ou transferência) e a
 * baixa é dada por quem opera a plataforma.
 */
export default function SubscriptionPage() {
  const { user, ready } = useSession('ADMIN');
  const toast = useToast();
  const [switchTo, setSwitchTo] = useState<PlanView | null>(null);
  const [switching, setSwitching] = useState(false);

  const fetchSummary = useCallback(
    () =>
      ready
        ? api<BillingSummary>('/admin/billing', { auth: true })
        : Promise.resolve(null),
    [ready],
  );
  const { data, loading, error, setData } = useAsyncData(fetchSummary);

  const confirmSwitch = async () => {
    if (!switchTo) return;
    setSwitching(true);
    try {
      const updated = await api<BillingSummary>('/admin/billing/plan', {
        method: 'PUT',
        auth: true,
        body: { planCode: switchTo.code },
      });
      setData(updated);
      toast.success(
        `Plano alterado para ${switchTo.name}`,
        'O novo valor vale a partir da próxima fatura.',
      );
      setSwitchTo(null);
    } catch (caught) {
      toast.error(
        'Não foi possível trocar de plano',
        caught instanceof ApiError ? caught.message : undefined,
      );
    } finally {
      setSwitching(false);
    }
  };

  if (!ready || !user) return null;

  return (
    <>
      <AppHeader
        area="Painel"
        subtitle="Assinatura"
        items={ADMIN_NAV}
        loginPath="/login?area=profissional"
      />

      <main id="conteudo" className="mx-auto w-full max-w-4xl px-4 py-8 sm:px-6">
        <PageHeading
          title="Assinatura"
          description="Seu plano do Gerente Barber, os profissionais em uso e as mensalidades."
        />

        {error && (
          <p
            role="alert"
            className="mb-6 rounded-xl border border-danger/30 bg-danger/10 px-4 py-3 text-sm font-medium text-danger"
          >
            {error.message}
          </p>
        )}

        {loading && !data ? (
          <div className="space-y-4">
            <Skeleton className="h-40" />
            <Skeleton className="h-64" />
          </div>
        ) : data ? (
          <div className="space-y-6">
            <StatusCard summary={data} />
            {data.openInvoice && !data.exempt && <OpenInvoiceCard summary={data} />}
            <PlansCard summary={data} onChoose={setSwitchTo} />
            <InvoicesCard summary={data} />
          </div>
        ) : null}
      </main>

      <ConfirmDialog
        open={switchTo !== null}
        title={`Mudar para o plano ${switchTo?.name ?? ''}?`}
        description={
          switchTo
            ? `${planCapacity(switchTo, formatBRL)} por ${formatBRL(switchTo.monthlyPrice)} ao mês. O valor novo vale a partir da próxima fatura; a que já está em aberto não muda.`
            : ''
        }
        confirmLabel="Mudar de plano"
        cancelLabel="Voltar"
        tone="primary"
        loading={switching}
        onConfirm={confirmSwitch}
        onCancel={() => setSwitchTo(null)}
      />
    </>
  );
}

function StatusCard({ summary }: { summary: BillingSummary }) {
  const status = BILLING_STATUS[summary.status];
  const { plan, activeBarbers } = summary;
  const limit = plan?.maxBarbers ?? null;
  const usage = limit ? Math.min(100, (activeBarbers / limit) * 100) : 0;

  return (
    <Card className="p-5 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs font-bold uppercase tracking-wider text-ink-subtle">
            Plano atual
          </p>
          <p className="mt-1 font-display text-3xl font-extrabold tracking-tight text-ink">
            {plan?.name ?? 'Sem plano'}
          </p>
          {plan && !summary.exempt && (
            <p className="mt-1 text-sm text-ink-muted">
              <span className="font-bold tabular text-brand-400">
                {formatBRL(summary.nextAmount ?? plan.monthlyPrice)}
              </span>{' '}
              por mês
            </p>
          )}
        </div>
        <Badge tone={status.tone} className="text-sm">
          {status.label}
        </Badge>
      </div>

      <div className="mt-5 grid gap-4 sm:grid-cols-2">
        <div>
          <p className="flex items-center gap-1.5 text-sm font-semibold text-ink">
            <Users className="h-4 w-4 text-ink-subtle" aria-hidden="true" />
            {activeBarbers}{' '}
            {limit
              ? `de ${limit} ${limit === 1 ? 'profissional' : 'profissionais'}`
              : activeBarbers === 1
                ? 'profissional ativo'
                : 'profissionais ativos'}
          </p>
          {limit && !summary.exempt && (
            <div
              className="mt-2 h-2 overflow-hidden rounded-full bg-surface-3"
              role="progressbar"
              aria-valuemin={0}
              aria-valuemax={limit}
              aria-valuenow={activeBarbers}
              aria-label="Profissionais em uso no plano"
            >
              <div
                className={cn(
                  'h-full rounded-full',
                  usage >= 100 ? 'bg-brand-400' : 'bg-success',
                )}
                style={{ width: `${usage}%` }}
              />
            </div>
          )}
        </div>
        <p className="text-sm text-ink-muted">
          {statusText(summary)}
        </p>
      </div>
    </Card>
  );
}

function statusText(summary: BillingSummary): string {
  switch (summary.status) {
    case 'EXEMPT':
      return 'Sua barbearia está em cortesia: sem mensalidade e sem limite de profissionais.';
    case 'TRIAL':
      return `Teste grátis até ${formatDate(summary.trialEndsAt!)}. A primeira mensalidade vence nesse dia.`;
    case 'PAST_DUE':
      return `A mensalidade está vencida. Depois de ${summary.graceDays} dias de atraso, o agendamento online é pausado até o pagamento.`;
    case 'BLOCKED':
      return 'O agendamento online está pausado por falta de pagamento. A agenda já marcada e o painel continuam funcionando; ao confirmar o pagamento, tudo volta na hora.';
    default:
      return summary.openInvoice
        ? `Próxima mensalidade vence em ${formatDate(summary.openInvoice.dueDate)}.`
        : 'Tudo em dia.';
  }
}

function OpenInvoiceCard({ summary }: { summary: BillingSummary }) {
  const invoice = summary.openInvoice!;
  const late = summary.status === 'PAST_DUE' || summary.status === 'BLOCKED';

  return (
    <Card
      className={cn(
        'p-5 sm:p-6',
        late
          ? 'border-danger/40 bg-danger/[0.06]'
          : 'border-brand-500/40 bg-brand-500/[0.05]',
      )}
    >
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <span
            className={cn(
              'flex h-10 w-10 shrink-0 items-center justify-center rounded-xl',
              late ? 'bg-danger/15 text-danger' : 'bg-brand-500/15 text-brand-400',
            )}
          >
            {late ? (
              <AlertTriangle className="h-5 w-5" aria-hidden="true" />
            ) : (
              <Receipt className="h-5 w-5" aria-hidden="true" />
            )}
          </span>
          <div>
            <p className="font-display text-lg font-bold text-ink">
              Mensalidade em aberto
            </p>
            <p className="text-sm text-ink-muted">
              {formatDate(invoice.periodStart)} a{' '}
              {formatDate(invoice.periodEnd)} · Plano {invoice.planName} ·{' '}
              {invoice.barbers}{' '}
              {invoice.barbers === 1 ? 'profissional' : 'profissionais'}
            </p>
          </div>
        </div>
        <div className="text-right">
          <p className="font-display text-2xl font-extrabold tabular text-ink">
            {formatBRL(invoice.amount)}
          </p>
          <p
            className={cn(
              'text-sm font-semibold',
              late ? 'text-danger' : 'text-ink-muted',
            )}
          >
            {late ? 'Venceu em' : 'Vence em'} {formatDate(invoice.dueDate)}
          </p>
        </div>
      </div>

      <div className="mt-4 rounded-xl border border-line bg-surface-1 px-4 py-3 text-sm">
        <p className="mb-1 flex items-center gap-1.5 font-semibold text-ink">
          <CreditCard className="h-4 w-4 text-brand-400" aria-hidden="true" />
          Como pagar
        </p>
        <p className="whitespace-pre-line text-ink-muted">
          {summary.paymentInstructions ||
            'As instruções de pagamento serão enviadas pelo WhatsApp. Em caso de dúvida, fale com o suporte do Gerente Barber.'}
        </p>
        <p className="mt-2 text-xs text-ink-subtle">
          Depois de pagar, a baixa é feita pelo suporte. Se o agendamento
          estiver pausado, ele volta assim que o pagamento for confirmado.
        </p>
      </div>
    </Card>
  );
}

function PlansCard({
  summary,
  onChoose,
}: {
  summary: BillingSummary;
  onChoose: (plan: PlanView) => void;
}) {
  return (
    <Card>
      <CardHeader
        title="Planos"
        description="Pelo número de profissionais ativos. A troca vale a partir da próxima fatura."
      />
      <CardBody>
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {summary.plans.map((plan) => {
            const current = plan.code === summary.plan?.code;
            return (
              <li
                key={plan.code}
                className={cn(
                  'flex flex-col rounded-xl border p-4',
                  current
                    ? 'border-brand-500 bg-brand-500/[0.08]'
                    : 'border-line bg-surface-2',
                )}
              >
                <div className="flex items-baseline justify-between gap-2">
                  <p className="font-display text-base font-bold text-ink">
                    {plan.name}
                  </p>
                  {current && <Badge tone="brand">Atual</Badge>}
                </div>
                <p className="mt-1 font-display text-xl font-extrabold tabular text-ink">
                  {formatBRL(plan.monthlyPrice)}
                  <span className="text-xs font-semibold text-ink-subtle">
                    {' '}
                    /mês
                  </span>
                </p>
                <p className="mt-1 text-xs text-ink-muted">
                  {planCapacity(plan, formatBRL)}
                </p>
                <div className="mt-auto pt-3">
                  {current ? (
                    <p className="flex items-center gap-1 text-xs font-semibold text-success">
                      <Check className="h-3.5 w-3.5" aria-hidden="true" />
                      Seu plano
                    </p>
                  ) : plan.fits ? (
                    <Button
                      variant="secondary"
                      size="sm"
                      block
                      onClick={() => onChoose(plan)}
                    >
                      Mudar para {plan.name}
                    </Button>
                  ) : (
                    <p className="text-xs text-ink-subtle">
                      Sua equipe tem {summary.activeBarbers} profissionais
                      ativos.
                    </p>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      </CardBody>
    </Card>
  );
}

function InvoicesCard({ summary }: { summary: BillingSummary }) {
  return (
    <Card>
      <CardHeader title="Mensalidades" description="Histórico de faturas." />
      {summary.invoices.length === 0 ? (
        <CardBody>
          <p className="text-sm text-ink-muted">
            {summary.exempt
              ? 'Barbearia em cortesia: nenhuma fatura é gerada.'
              : 'Nenhuma fatura ainda. A primeira é gerada alguns dias antes do vencimento.'}
          </p>
        </CardBody>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-line text-left text-xs uppercase tracking-wider text-ink-subtle">
                <th className="px-5 py-3 font-semibold">Período</th>
                <th className="px-3 py-3 font-semibold">Vencimento</th>
                <th className="px-3 py-3 font-semibold">Plano</th>
                <th className="px-3 py-3 text-right font-semibold">Valor</th>
                <th className="px-5 py-3 text-right font-semibold">Situação</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {summary.invoices.map((invoice) => {
                const status = INVOICE_STATUS[invoice.status];
                return (
                  <tr key={invoice.id}>
                    <td className="px-5 py-3 tabular text-ink">
                      {formatDate(invoice.periodStart)} –{' '}
                      {formatDate(invoice.periodEnd)}
                    </td>
                    <td className="px-3 py-3 tabular text-ink-muted">
                      {formatDate(invoice.dueDate)}
                    </td>
                    <td className="px-3 py-3 text-ink-muted">
                      {invoice.planName}
                    </td>
                    <td className="px-3 py-3 text-right font-semibold tabular text-ink">
                      {formatBRL(invoice.amount)}
                    </td>
                    <td className="px-5 py-3 text-right">
                      <Badge tone={status.tone}>{status.label}</Badge>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}
