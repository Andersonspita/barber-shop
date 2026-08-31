/**
 * Arquivo .ics para o cliente jogar o horário na agenda do celular.
 *
 * A confirmação de agendamento era uma linha de texto âmbar abaixo do botão —
 * o momento de maior valor do produto sem nenhum desdobramento.
 */
export function buildCalendarEvent(params: {
  title: string;
  description: string;
  location?: string;
  start: Date;
  end: Date;
}): string {
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Gerente Barber//Agendamento//PT-BR',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `UID:${crypto.randomUUID()}@gerentebarber`,
    `DTSTAMP:${toICSDate(new Date())}`,
    `DTSTART:${toICSDate(params.start)}`,
    `DTEND:${toICSDate(params.end)}`,
    `SUMMARY:${escapeICS(params.title)}`,
    `DESCRIPTION:${escapeICS(params.description)}`,
    ...(params.location ? [`LOCATION:${escapeICS(params.location)}`] : []),
    'BEGIN:VALARM',
    'TRIGGER:-PT2H',
    'ACTION:DISPLAY',
    `DESCRIPTION:${escapeICS(params.title)}`,
    'END:VALARM',
    'END:VEVENT',
    'END:VCALENDAR',
  ];

  return lines.join('\r\n');
}

export function downloadCalendarEvent(content: string, filename: string) {
  const blob = new Blob([content], { type: 'text/calendar;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

function toICSDate(date: Date): string {
  return date.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
}

function escapeICS(value: string): string {
  return value
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\n/g, '\\n');
}
