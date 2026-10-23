'use client';

import React, { useCallback } from 'react';
import Link from 'next/link';
import { AlertTriangle, Receipt } from 'lucide-react';
import { api } from '@/lib/api';
import { useAsyncData } from '@/lib/use-async-data';
import { formatBRL, formatDate, parseISODate, todayISO } from '@/lib/format';
import { BillingSummary } from '@/lib/billing';
import { useShop } from '@/lib/shop-context';
import { cn } from '@/lib/cn';

/**
 * Aviso de mensalidade no topo da agenda do admin. Só aparece quando há
 * algo a fazer: fatura aberta, atraso, agendamento pausado ou fim do teste
 * grátis chegando.
 */
export function BillingBanner() {
  const shop = useShop();
  const fetchSummary = useCallback(
    () => api<BillingSummary>('/admin/billing', { auth: true }),
    [],
  );
  const { data } = useAsyncData(fetchSummary);
  if (!data) return null;

  const message = bannerMessage(data);
  if (!message) return null;
  const urgent = data.status === 'PAST_DUE' || data.status === 'BLOCKED';

  return (
    <div
      role={urgent ? 'alert' : 'status'}
      className={cn(
        'mb-6 flex flex-col gap-3 rounded-card border px-4 py-3 sm:flex-row sm:items-center sm:justify-between',
        urgent
          ? 'border-danger/40 bg-danger/10'
          : 'border-brand-500/40 bg-brand-500/[0.08]',
      )}
    >
      <p className="flex items-start gap-2 text-sm text-ink">
        {urgent ? (
          <AlertTriangle
            className="mt-0.5 h-4 w-4 shrink-0 text-danger"
            aria-hidden="true"
          />
        ) : (
          <Receipt
            className="mt-0.5 h-4 w-4 shrink-0 text-brand-400"
            aria-hidden="true"
          />
        )}
        {message}
      </p>
      <Link
        href={shop.href('/dashboard/assinatura')}
        className={cn(
          'shrink-0 rounded-lg px-3 py-2 text-center text-xs font-bold transition-colors',
          urgent
            ? 'bg-danger text-surface-0 hover:bg-danger-dim'
            : 'bg-brand-500 text-surface-0 hover:bg-brand-400',
        )}
      >
        Ver assinatura
      </Link>
    </div>
  );
}

function daysUntil(isoDate: string): number {
  const ms = parseISODate(isoDate).getTime() - parseISODate(todayISO()).getTime();
  return Math.round(ms / 86_400_000);
}

function bannerMessage(summary: BillingSummary): string | null {
  const invoice = summary.openInvoice;
  switch (summary.status) {
    case 'BLOCKED':
      return 'O agendamento online está pausado por falta de pagamento. A agenda e o painel seguem funcionando; regularize para liberar os clientes.';
    case 'PAST_DUE':
      return invoice
        ? `A mensalidade de ${formatBRL(invoice.amount)} venceu em ${formatDate(invoice.dueDate)}. Depois de ${summary.graceDays} dias de atraso, o agendamento online é pausado.`
        : null;
    case 'EXEMPT':
      return null;
    default:
      if (invoice) {
        return `Mensalidade de ${formatBRL(invoice.amount)} disponível, com vencimento em ${formatDate(invoice.dueDate)}.`;
      }
      if (summary.status === 'TRIAL' && summary.trialEndsAt) {
        const left = daysUntil(summary.trialEndsAt);
        if (left <= 3) {
          return `Seu teste grátis termina ${left <= 0 ? 'hoje' : left === 1 ? 'amanhã' : `em ${left} dias`}. A mensalidade do plano ${summary.plan?.name ?? ''} começa em seguida.`;
        }
      }
      return null;
  }
}
