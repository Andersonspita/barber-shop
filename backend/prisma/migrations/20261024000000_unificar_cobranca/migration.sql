-- Unificação da cobrança: a situação da assinatura passa a ser calculada a partir
-- das faturas (mensalidade, 20260923). Saem os campos da primeira versão com Asaas,
-- que guardavam essa situação à parte; o Asaas vira um meio de pagar cada fatura.

ALTER TABLE "shops"
  DROP COLUMN IF EXISTS "subscriptionStatus",
  DROP COLUMN IF EXISTS "plan",
  DROP COLUMN IF EXISTS "pendingPlan",
  DROP COLUMN IF EXISTS "asaasSubscriptionId",
  DROP COLUMN IF EXISTS "billingInvoiceUrl",
  DROP COLUMN IF EXISTS "pastDueSince",
  -- Quem paga escolhe Pix, boleto ou cartão na própria fatura do Asaas.
  DROP COLUMN IF EXISTS "billingMethod";

DROP TYPE IF EXISTS "SubscriptionStatus";
DROP TYPE IF EXISTS "Plan";
DROP TYPE IF EXISTS "BillingMethod";

-- Cobrança de cada fatura no Asaas, quando a barbearia paga online.
ALTER TABLE "invoices"
  ADD COLUMN "asaasPaymentId" TEXT,
  ADD COLUMN "invoiceUrl" TEXT;

CREATE UNIQUE INDEX "invoices_asaasPaymentId_key" ON "invoices"("asaasPaymentId");
