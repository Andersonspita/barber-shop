import type { Plan } from '@prisma/client';

/**
 * Mensalidade de cada plano, em reais — a matriz do Gerente Barber por número
 * de cadeiras. Mudar aqui vale para assinaturas novas; as já criadas no Asaas
 * mantêm o valor até serem refeitas.
 */
export const PLAN_PRICES: Record<Plan, number> = {
  SOLO: 49.9,
  SQUAD: 99.9,
  PRO: 179.9,
  EMPIRE: 299.9,
};

export const PLAN_NAMES: Record<Plan, string> = {
  SOLO: 'Solo (1 cadeira)',
  SQUAD: 'Squad (2 a 4 cadeiras)',
  PRO: 'Pro (5 a 9 cadeiras)',
  EMPIRE: 'Empire (10+ cadeiras)',
};

/** Dias de tolerância entre a mensalidade vencer e a página sair do ar. */
export function billingGraceDays(): number {
  return Number(process.env.BILLING_GRACE_DAYS ?? 5);
}
