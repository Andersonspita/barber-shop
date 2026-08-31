import {
  daysBetween,
  parseDateOnly,
  shopDateOnly,
  shopDayRange,
  shopHourLabel,
  shopTimeToUtc,
  shopWeekday,
} from './time.util';

const SP = 'America/Sao_Paulo';

describe('time.util', () => {
  describe('shopTimeToUtc', () => {
    it('converte o horário de parede da barbearia para UTC', () => {
      // 09:00 em São Paulo (UTC-3) é 12:00 UTC. O bug original montava a data
      // com o construtor local e, num contêiner em UTC, gerava 09:00 UTC —
      // ou seja, 06:00 para o cliente.
      const nineAM = shopTimeToUtc('2026-03-10', 9 * 60, SP);
      expect(nineAM.toISOString()).toBe('2026-03-10T12:00:00.000Z');
    });

    it('não depende do fuso do processo', () => {
      const original = process.env.TZ;
      try {
        process.env.TZ = 'UTC';
        const inUtc = shopTimeToUtc('2026-03-10', 9 * 60, SP).toISOString();

        process.env.TZ = 'Asia/Tokyo';
        const inTokyo = shopTimeToUtc('2026-03-10', 9 * 60, SP).toISOString();

        expect(inUtc).toBe(inTokyo);
      } finally {
        process.env.TZ = original;
      }
    });

    it('aceita minutos acima de 1440 para expediente que vira o dia', () => {
      const oneAM = shopTimeToUtc('2026-03-10', 25 * 60, SP);
      expect(oneAM.toISOString()).toBe('2026-03-11T04:00:00.000Z');
    });
  });

  describe('shopDayRange', () => {
    it('cobre exatamente as 24 horas do dia da barbearia', () => {
      const { start, end } = shopDayRange('2026-03-10', SP);
      expect(start.toISOString()).toBe('2026-03-10T03:00:00.000Z');
      expect(end.toISOString()).toBe('2026-03-11T03:00:00.000Z');
    });
  });

  describe('shopDateOnly', () => {
    it('devolve o dia da barbearia, não o dia UTC', () => {
      // 02:00 UTC de 11/03 ainda é 23:00 de 10/03 em São Paulo. Era aqui que
      // a agenda do dia seguinte aparecia no lugar da de hoje.
      const lateNight = new Date('2026-03-11T02:00:00.000Z');
      expect(shopDateOnly(lateNight, SP)).toBe('2026-03-10');
      expect(shopDateOnly(lateNight, 'UTC')).toBe('2026-03-11');
    });
  });

  describe('shopWeekday', () => {
    it('usa o dia da semana local da barbearia', () => {
      // Domingo 02:00 UTC ainda é sábado à noite em São Paulo.
      const sundayUtc = new Date('2026-03-15T02:00:00.000Z');
      expect(shopWeekday(sundayUtc, 'UTC')).toBe(0);
      expect(shopWeekday(sundayUtc, SP)).toBe(6);
    });
  });

  describe('shopHourLabel', () => {
    it('formata em 24 horas no fuso da barbearia', () => {
      expect(shopHourLabel(new Date('2026-03-10T12:00:00.000Z'), SP)).toBe(
        '09:00',
      );
    });
  });

  describe('parseDateOnly', () => {
    it('aceita o formato AAAA-MM-DD', () => {
      expect(parseDateOnly('2026-03-10')).toBe('2026-03-10');
    });

    it.each(['10/03/2026', '2026-3-1', '', 'amanhã'])(
      'recusa "%s"',
      (value) => {
        expect(() => parseDateOnly(value)).toThrow();
      },
    );
  });

  describe('daysBetween', () => {
    it('conta os dias entre duas datas', () => {
      expect(daysBetween('2026-03-10', '2026-03-12')).toBe(2);
      expect(daysBetween('2026-03-12', '2026-03-10')).toBe(-2);
    });

    it('atravessa a virada do horário de verão sem perder um dia', () => {
      expect(daysBetween('2026-10-17', '2026-10-19')).toBe(2);
    });
  });
});
