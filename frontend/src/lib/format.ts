/**
 * Formatação única do produto.
 *
 * Antes o mesmo valor aparecia como "R$ 70" na vitrine, "R$ 70,00" no
 * financeiro e "R$ 70.5" nos cards de agendamento — este último era o número
 * cru vindo do Prisma.
 */

const BRL = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
});

const BRL_COMPACT = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
  maximumFractionDigits: 0,
});

export function formatBRL(value: number | string | null | undefined): string {
  return BRL.format(toNumber(value));
}

/** Sem centavos, para a vitrine de serviços. */
export function formatBRLCompact(
  value: number | string | null | undefined,
): string {
  return BRL_COMPACT.format(toNumber(value));
}

export function toNumber(value: number | string | null | undefined): number {
  if (value === null || value === undefined) return 0;
  const parsed = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

// ------------------------------------------------------------------- datas

const DATE_LONG = new Intl.DateTimeFormat('pt-BR', {
  weekday: 'long',
  day: '2-digit',
  month: 'long',
});

const DATE_SHORT = new Intl.DateTimeFormat('pt-BR', {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
});

const DAY_MONTH = new Intl.DateTimeFormat('pt-BR', {
  day: '2-digit',
  month: '2-digit',
});

const TIME = new Intl.DateTimeFormat('pt-BR', {
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
});

const WEEKDAY_SHORT = new Intl.DateTimeFormat('pt-BR', { weekday: 'short' });

/**
 * "segunda-feira, 31 de agosto" com a inicial maiúscula. A classe `capitalize`
 * do CSS não serve aqui: ela sobe a primeira letra de cada palavra e produz
 * "Segunda-Feira, 31 De Agosto".
 */
export function formatDateLong(value: string | Date): string {
  const formatted = DATE_LONG.format(asDate(value));
  return formatted.charAt(0).toUpperCase() + formatted.slice(1);
}

export function formatDate(value: string | Date): string {
  return DATE_SHORT.format(asDate(value));
}

export function formatDayMonth(value: string | Date): string {
  return DAY_MONTH.format(asDate(value));
}

export function formatTime(value: string | Date): string {
  return TIME.format(asDate(value));
}

export function formatDateTime(value: string | Date): string {
  return `${formatDate(value)} às ${formatTime(value)}`;
}

export function formatWeekdayShort(value: string | Date): string {
  return WEEKDAY_SHORT.format(asDate(value)).replace('.', '');
}

/**
 * Uma data pura (`YYYY-MM-DD`) é lida como dia local, não como meia-noite
 * UTC: `new Date('2026-09-22')` no Brasil (UTC−3) ainda é dia 21, e a agenda
 * do dia 22 aparecia como "Segunda-feira, 21 de setembro".
 */
function asDate(value: string | Date): Date {
  if (value instanceof Date) return value;
  return /^\d{4}-\d{2}-\d{2}$/.test(value)
    ? parseISODate(value)
    : new Date(value);
}

/** `YYYY-MM-DD` de hoje, no relógio de quem está olhando a tela. */
export function todayISO(): string {
  return toISODate(new Date());
}

export function toISODate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function addDaysISO(isoDate: string, days: number): string {
  const date = new Date(`${isoDate}T12:00:00`);
  date.setDate(date.getDate() + days);
  return toISODate(date);
}

/** Uma data `YYYY-MM-DD` como Date local, sem escorregar de dia por fuso. */
export function parseISODate(isoDate: string): Date {
  return new Date(`${isoDate}T12:00:00`);
}

// ------------------------------------------------------------------ diversos

/** Iniciais para o avatar de quem ainda não tem foto. */
export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts.at(-1)![0]}`.toUpperCase();
}

export function formatDuration(minutes: number): string {
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest === 0 ? `${hours}h` : `${hours}h${String(rest).padStart(2, '0')}`;
}

export function formatPhone(raw: string | null | undefined): string {
  if (!raw) return '';
  const digits = raw.replace(/\D/g, '').slice(-11);
  if (digits.length === 11) {
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
  }
  if (digits.length === 10) {
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
  }
  return raw;
}

/** Minutos desde a meia-noite como `HH:MM`, para a tela de jornada. */
export function minutesToLabel(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return `${String(hours).padStart(2, '0')}:${String(rest).padStart(2, '0')}`;
}

export function labelToMinutes(label: string): number {
  const [hours, minutes] = label.split(':').map(Number);
  return (hours || 0) * 60 + (minutes || 0);
}

/**
 * "Hoje", "Amanhã" ou "Em 3 dias" — é assim que Booksy, Fresha e afins
 * anunciam o próximo horário, e é o que o cliente quer saber primeiro.
 */
export function relativeDayLabel(value: string | Date): string {
  const target = parseISODate(toISODate(asDate(value)));
  const today = parseISODate(todayISO());
  const days = Math.round((target.getTime() - today.getTime()) / 86_400_000);
  if (days === 0) return 'Hoje';
  if (days === 1) return 'Amanhã';
  if (days === -1) return 'Ontem';
  if (days > 1) return `Em ${days} dias`;
  return `Há ${-days} dias`;
}

/** Período do dia de um horário `HH:MM`, para agrupar a grade de horários. */
export function dayPeriod(time: string): 'Manhã' | 'Tarde' | 'Noite' {
  const hour = Number(time.slice(0, 2));
  if (hour < 12) return 'Manhã';
  if (hour < 18) return 'Tarde';
  return 'Noite';
}
