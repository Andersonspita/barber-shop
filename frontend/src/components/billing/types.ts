export type SubscriptionStatus =
  | 'TRIAL'
  | 'ACTIVE'
  | 'EXPIRED'
  | 'PAST_DUE'
  | 'SUSPENDED';
export type PlanCode = 'SOLO' | 'SQUAD' | 'PRO' | 'EMPIRE';
export type BillingMethod = 'PIX' | 'BOLETO' | 'CREDIT_CARD';

/** Resposta de `GET /admin/billing`. */
export interface BillingStatus {
  enabled: boolean;
  subscriptionStatus: SubscriptionStatus;
  plan: PlanCode | null;
  pendingPlan: PlanCode | null;
  billingMethod: BillingMethod | null;
  trialEndsAt: string | null;
  pastDueSince: string | null;
  suspendsAt: string | null;
  invoiceUrl: string | null;
  hasSubscription: boolean;
  plans: Array<{ code: PlanCode; name: string; price: number }>;
}

export const METHOD_LABELS: Record<BillingMethod, string> = {
  PIX: 'Pix',
  BOLETO: 'Boleto',
  CREDIT_CARD: 'Cartão de crédito',
};
