/** Jornada inicial do primeiro admin: seg-sex 09h-18h, sábado 09h-14h. */
export const DEFAULT_SHIFTS = [
  ...[1, 2, 3, 4, 5].map((weekday) => ({
    weekday,
    startMinute: 9 * 60,
    endMinute: 18 * 60,
  })),
  { weekday: 6, startMinute: 9 * 60, endMinute: 14 * 60 },
];
