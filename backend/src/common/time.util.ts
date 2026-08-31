import { BadRequestException } from '@nestjs/common';
import { addMinutes } from 'date-fns';
import { formatInTimeZone, fromZonedTime, toZonedTime } from 'date-fns-tz';

/**
 * Todo horário é persistido em UTC. O expediente, os feriados e a agenda que o
 * cliente enxerga, porém, são definidos em horário de parede da barbearia — e o
 * contêiner roda em UTC. Estas funções fazem a tradução entre os dois mundos, de
 * modo que nada no sistema dependa do fuso do processo.
 */

const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;

/** Valida uma data no formato `YYYY-MM-DD` e devolve a string normalizada. */
export function parseDateOnly(value: string, field = 'date'): string {
  if (!value || !DATE_ONLY.test(value)) {
    throw new BadRequestException(
      `${field} deve estar no formato AAAA-MM-DD.`,
    );
  }
  const probe = new Date(`${value}T12:00:00Z`);
  if (Number.isNaN(probe.getTime())) {
    throw new BadRequestException(`${field} não é uma data válida.`);
  }
  return value;
}

/**
 * Instante UTC correspondente a um horário de parede da barbearia.
 * `minutesFromMidnight` aceita valores acima de 1440 para expedientes que
 * atravessam a meia-noite.
 */
export function shopTimeToUtc(
  dateOnly: string,
  minutesFromMidnight: number,
  timezone: string,
): Date {
  const midnight = fromZonedTime(`${dateOnly}T00:00:00`, timezone);
  return addMinutes(midnight, minutesFromMidnight);
}

/** Intervalo UTC `[início, fim)` que cobre o dia da barbearia. */
export function shopDayRange(
  dateOnly: string,
  timezone: string,
): { start: Date; end: Date } {
  return {
    start: shopTimeToUtc(dateOnly, 0, timezone),
    end: shopTimeToUtc(dateOnly, 24 * 60, timezone),
  };
}

/** Intervalo UTC que cobre de `startDate` a `endDate`, ambos inclusive. */
export function shopRange(
  startDateOnly: string,
  endDateOnly: string,
  timezone: string,
): { start: Date; end: Date } {
  return {
    start: shopDayRange(startDateOnly, timezone).start,
    end: shopDayRange(endDateOnly, timezone).end,
  };
}

/** Dia da semana no fuso da barbearia: 0 = domingo … 6 = sábado. */
export function shopWeekday(date: Date, timezone: string): number {
  return toZonedTime(date, timezone).getDay();
}

/** Data `YYYY-MM-DD` de um instante, no fuso da barbearia. */
export function shopDateOnly(date: Date, timezone: string): string {
  return formatInTimeZone(date, timezone, 'yyyy-MM-dd');
}

/** Hora `HH:mm` de um instante, no fuso da barbearia. */
export function shopHourLabel(date: Date, timezone: string): string {
  return formatInTimeZone(date, timezone, 'HH:mm');
}

/**
 * Meia-noite UTC do dia informado. As colunas `@db.Date` (feriados, lista de
 * espera) guardam a data pura, sem componente de horário.
 */
export function dateOnlyToUtcMidnight(dateOnly: string): Date {
  return new Date(`${dateOnly}T00:00:00.000Z`);
}

/** Hoje, no fuso da barbearia, como `YYYY-MM-DD`. */
export function shopToday(timezone: string, now = new Date()): string {
  return shopDateOnly(now, timezone);
}

/** Diferença em dias entre duas datas `YYYY-MM-DD`. */
export function daysBetween(fromDateOnly: string, toDateOnly: string): number {
  const from = dateOnlyToUtcMidnight(fromDateOnly).getTime();
  const to = dateOnlyToUtcMidnight(toDateOnly).getTime();
  return Math.round((to - from) / 86_400_000);
}
