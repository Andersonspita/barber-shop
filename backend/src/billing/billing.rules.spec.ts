import {
  addMonthsISO,
  billingStatus,
  canAddBarber,
  invoiceAmountCents,
  nextInvoicePeriod,
  planFits,
  smallestPlanFor,
} from './billing.rules';

const plan = (
  code: string,
  maxBarbers: number | null,
  monthlyPrice: string,
  extra: string | null = null,
  includedBarbers = maxBarbers ?? 10,
  sortOrder = 0,
) => ({
  code,
  name: code,
  maxBarbers,
  includedBarbers,
  monthlyPrice,
  extraBarberPrice: extra,
  sortOrder,
});

const SOLO = plan('solo', 1, '35.00', null, 1, 1);
const ESSENCIAL = plan('essencial', 3, '89.90', null, 3, 2);
const REDE = plan('rede', null, '219.90', '19.90', 10, 5);

describe('regras da mensalidade', () => {
  describe('valor', () => {
    it('cobra a mensalidade do plano', () => {
      expect(invoiceAmountCents(SOLO, 1)).toBe(3500);
      expect(invoiceAmountCents(ESSENCIAL, 2)).toBe(8990);
    });

    it('no plano sem limite, soma os profissionais excedentes', () => {
      expect(invoiceAmountCents(REDE, 10)).toBe(21990);
      expect(invoiceAmountCents(REDE, 13)).toBe(21990 + 3 * 1990);
    });
  });

  describe('limite de profissionais', () => {
    it('bloqueia o profissional além do plano', () => {
      expect(canAddBarber(SOLO, false, 0)).toBe(true);
      expect(canAddBarber(SOLO, false, 1)).toBe(false);
      expect(canAddBarber(ESSENCIAL, false, 2)).toBe(true);
      expect(canAddBarber(ESSENCIAL, false, 3)).toBe(false);
    });

    it('cortesia e plano sem limite não bloqueiam', () => {
      expect(canAddBarber(SOLO, true, 5)).toBe(true);
      expect(canAddBarber(REDE, false, 40)).toBe(true);
      expect(canAddBarber(null, false, 3)).toBe(true);
    });

    it('não troca para um plano menor que a equipe', () => {
      expect(planFits(SOLO, 2)).toBe(false);
      expect(planFits(ESSENCIAL, 3)).toBe(true);
    });

    it('sugere o menor plano que comporta a equipe', () => {
      expect(smallestPlanFor([REDE, ESSENCIAL, SOLO], 1)?.code).toBe('solo');
      expect(smallestPlanFor([REDE, ESSENCIAL, SOLO], 2)?.code).toBe(
        'essencial',
      );
      expect(smallestPlanFor([REDE, ESSENCIAL, SOLO], 25)?.code).toBe('rede');
    });
  });

  describe('situação', () => {
    const base = {
      exempt: false,
      today: '2026-10-10',
      trialEndsAt: null,
      oldestOpenDue: null,
      graceDays: 7,
    };

    it('cortesia sempre em dia', () => {
      expect(
        billingStatus({ ...base, exempt: true, oldestOpenDue: '2026-01-01' }),
      ).toBe('EXEMPT');
    });

    it('teste grátis até o fim do período de teste', () => {
      expect(billingStatus({ ...base, trialEndsAt: '2026-10-11' })).toBe(
        'TRIAL',
      );
      expect(billingStatus({ ...base, trialEndsAt: '2026-10-10' })).toBe(
        'ACTIVE',
      );
    });

    it('fatura a vencer ou vencendo hoje ainda está em dia', () => {
      expect(billingStatus({ ...base, oldestOpenDue: '2026-10-15' })).toBe(
        'ACTIVE',
      );
      expect(billingStatus({ ...base, oldestOpenDue: '2026-10-10' })).toBe(
        'ACTIVE',
      );
    });

    it('vencida dentro da tolerância: em atraso, sem bloqueio', () => {
      expect(billingStatus({ ...base, oldestOpenDue: '2026-10-09' })).toBe(
        'PAST_DUE',
      );
      expect(billingStatus({ ...base, oldestOpenDue: '2026-10-03' })).toBe(
        'PAST_DUE',
      );
    });

    it('passou da tolerância: bloqueia o agendamento online', () => {
      expect(billingStatus({ ...base, oldestOpenDue: '2026-10-02' })).toBe(
        'BLOCKED',
      );
    });
  });

  describe('períodos', () => {
    it('soma meses preso ao fim do mês', () => {
      expect(addMonthsISO('2026-01-31', 1)).toBe('2026-02-28');
      expect(addMonthsISO('2028-01-31', 1)).toBe('2028-02-29');
      expect(addMonthsISO('2026-12-15', 1)).toBe('2027-01-15');
    });

    it('a primeira fatura começa no fim do teste e sai 5 dias antes', () => {
      const input = {
        firstPeriodStart: '2026-10-20',
        lastPeriodEnd: null,
        daysBefore: 5,
      };
      expect(nextInvoicePeriod({ ...input, today: '2026-10-14' })).toBeNull();
      expect(nextInvoicePeriod({ ...input, today: '2026-10-15' })).toEqual({
        periodStart: '2026-10-20',
        periodEnd: '2026-11-20',
      });
    });

    it('as seguintes emendam no fim da anterior', () => {
      expect(
        nextInvoicePeriod({
          today: '2026-11-16',
          firstPeriodStart: '2026-10-20',
          lastPeriodEnd: '2026-11-20',
          daysBefore: 5,
        }),
      ).toEqual({ periodStart: '2026-11-20', periodEnd: '2026-12-20' });
    });

    it('gerar agora ignora a antecedência', () => {
      expect(
        nextInvoicePeriod({
          today: '2026-10-01',
          firstPeriodStart: '2026-10-20',
          lastPeriodEnd: null,
          daysBefore: 5,
          force: true,
        })?.periodStart,
      ).toBe('2026-10-20');
    });
  });
});
