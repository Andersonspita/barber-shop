/** Tipos e rótulos da mensalidade, usados pelo painel do admin e pela plataforma. */

export type BillingStatus = 'EXEMPT' | 'TRIAL' | 'ACTIVE' | 'PAST_DUE' | 'BLOCKED';

export interface PlanView {
  code: string;
  name: string;
  maxBarbers: number | null;
  includedBarbers: number;
  monthlyPrice: string;
  extraBarberPrice: string | null;
  fits?: boolean;
}

export interface InvoiceView {
  id: string;
  periodStart: string;
  periodEnd: string;
  dueDate: string;
  planCode: string;
  planName: string;
  barbers: number;
  amount: string;
  status: 'OPEN' | 'PAID' | 'CANCELED';
  paidAt: string | null;
  note: string | null;
}

export interface BillingSummary {
  status: BillingStatus;
  exempt: boolean;
  plan: PlanView | null;
  activeBarbers: number;
  nextAmount: string | null;
  trialEndsAt: string | null;
  openInvoice: InvoiceView | null;
  invoices: InvoiceView[];
  plans: PlanView[];
  graceDays: number;
  paymentInstructions: string;
}

export const BILLING_STATUS: Record<
  BillingStatus,
  { label: string; tone: 'success' | 'brand' | 'warning' | 'danger' | 'neutral' }
> = {
  EXEMPT: { label: 'Cortesia', tone: 'success' },
  TRIAL: { label: 'Teste grátis', tone: 'brand' },
  ACTIVE: { label: 'Em dia', tone: 'success' },
  PAST_DUE: { label: 'Em atraso', tone: 'warning' },
  BLOCKED: { label: 'Agendamento pausado', tone: 'danger' },
};

export const INVOICE_STATUS: Record<
  InvoiceView['status'],
  { label: string; tone: 'success' | 'brand' | 'neutral' }
> = {
  OPEN: { label: 'Em aberto', tone: 'brand' },
  PAID: { label: 'Paga', tone: 'success' },
  CANCELED: { label: 'Cancelada', tone: 'neutral' },
};

/** "Até 3 profissionais", "1 profissional", "10 incluídos + R$ 19,90 por extra". */
export function planCapacity(plan: PlanView, formatBRL: (v: string) => string): string {
  if (plan.maxBarbers === null) {
    return `${plan.includedBarbers} profissionais incluídos + ${formatBRL(plan.extraBarberPrice ?? '0')} por profissional extra`;
  }
  if (plan.maxBarbers === 1) return '1 profissional';
  return `Até ${plan.maxBarbers} profissionais`;
}
