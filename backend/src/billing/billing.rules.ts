import { daysBetween } from '../common/time.util';

/**
 * Regras da mensalidade, sem banco nem relógio: tudo recebe as datas como
 * `YYYY-MM-DD` no fuso da barbearia. É o que permite testar vencimento,
 * atraso e bloqueio sem depender do dia em que o teste roda.
 */

export interface PlanLike {
  code: string;
  name: string;
  maxBarbers: number | null;
  includedBarbers: number;
  monthlyPrice: number | string | { toString(): string };
  extraBarberPrice: number | string | { toString(): string } | null;
}

/**
 * Situação da assinatura:
 * - EXEMPT: cortesia, não gera fatura.
 * - TRIAL: teste grátis em andamento.
 * - ACTIVE: em dia (pode ter fatura aberta ainda não vencida).
 * - PAST_DUE: fatura vencida, dentro da tolerância. Tudo funciona.
 * - BLOCKED: passou da tolerância. O agendamento online fica pausado.
 */
export type BillingStatus =
  'EXEMPT' | 'TRIAL' | 'ACTIVE' | 'PAST_DUE' | 'BLOCKED';

/** Valor da mensalidade em centavos, para não somar dinheiro em ponto flutuante. */
export function invoiceAmountCents(plan: PlanLike, barbers: number): number {
  const base = toCents(plan.monthlyPrice);
  const extraPrice =
    plan.extraBarberPrice === null ? 0 : toCents(plan.extraBarberPrice);
  const extras = Math.max(0, barbers - plan.includedBarbers);
  return base + extras * extraPrice;
}

export function centsToDecimalString(cents: number): string {
  return (cents / 100).toFixed(2);
}

function toCents(value: number | string | { toString(): string }): number {
  return Math.round(Number(value.toString()) * 100);
}

/** Cabe mais um profissional ativo no plano? Cortesia e plano sem limite: sempre. */
export function canAddBarber(
  plan: Pick<PlanLike, 'maxBarbers'> | null,
  exempt: boolean,
  activeBarbers: number,
): boolean {
  if (exempt || !plan || plan.maxBarbers === null) return true;
  return activeBarbers < plan.maxBarbers;
}

/** O plano comporta a equipe atual? Usado ao trocar de plano. */
export function planFits(
  plan: Pick<PlanLike, 'maxBarbers'>,
  activeBarbers: number,
): boolean {
  return plan.maxBarbers === null || activeBarbers <= plan.maxBarbers;
}

/** Plano mais barato que comporta a equipe. */
export function smallestPlanFor<T extends PlanLike & { sortOrder: number }>(
  plans: T[],
  activeBarbers: number,
): T | undefined {
  return [...plans]
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .find((plan) => planFits(plan, activeBarbers));
}

export function billingStatus(input: {
  exempt: boolean;
  today: string;
  trialEndsAt: string | null;
  /** Vencimento da fatura aberta mais antiga, se houver. */
  oldestOpenDue: string | null;
  graceDays: number;
}): BillingStatus {
  if (input.exempt) return 'EXEMPT';

  if (input.oldestOpenDue) {
    const late = daysBetween(input.oldestOpenDue, input.today);
    if (late > input.graceDays) return 'BLOCKED';
    if (late > 0) return 'PAST_DUE';
  }

  if (input.trialEndsAt && input.today < input.trialEndsAt) return 'TRIAL';
  return 'ACTIVE';
}

/**
 * Soma meses a uma data `YYYY-MM-DD`, preso ao último dia do mês quando
 * preciso: 31/01 + 1 mês = 28/02 (ou 29/02). Não usa o relógio do processo,
 * então não escorrega de dia por fuso.
 */
export function addMonthsISO(date: string, months: number): string {
  const [y, m, d] = date.split('-').map(Number);
  const total = y * 12 + (m - 1) + months;
  const year = Math.floor(total / 12);
  const month = (total % 12) + 1;
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const day = Math.min(d, lastDay);
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

export function addDaysISO(date: string, days: number): string {
  const at = new Date(`${date}T12:00:00.000Z`);
  at.setUTCDate(at.getUTCDate() + days);
  return at.toISOString().slice(0, 10);
}

/**
 * Próxima fatura a gerar. A primeira cobre o mês que começa no fim do teste
 * (ou na criação, sem teste); as seguintes emendam no fim da anterior. Ela é
 * gerada `daysBefore` dias antes do vencimento, para dar tempo de pagar.
 */
export function nextInvoicePeriod(input: {
  today: string;
  firstPeriodStart: string;
  lastPeriodEnd: string | null;
  daysBefore: number;
  force?: boolean;
}): { periodStart: string; periodEnd: string } | null {
  const periodStart = input.lastPeriodEnd ?? input.firstPeriodStart;
  const issueFrom = addDaysISO(periodStart, -input.daysBefore);
  if (!input.force && input.today < issueFrom) return null;
  return { periodStart, periodEnd: addMonthsISO(periodStart, 1) };
}
