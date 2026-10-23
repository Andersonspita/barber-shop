-- Cobrança recorrente pelo Asaas: assinatura, inadimplência e suspensão.
-- Nenhuma barbearia existente muda de situação.

ALTER TYPE "SubscriptionStatus" ADD VALUE 'PAST_DUE';
ALTER TYPE "SubscriptionStatus" ADD VALUE 'SUSPENDED';

CREATE TYPE "BillingMethod" AS ENUM ('PIX', 'BOLETO', 'CREDIT_CARD');

ALTER TABLE "shops"
  ADD COLUMN "pendingPlan" "Plan",
  ADD COLUMN "billingMethod" "BillingMethod",
  ADD COLUMN "asaasCustomerId" TEXT,
  ADD COLUMN "asaasSubscriptionId" TEXT,
  ADD COLUMN "billingInvoiceUrl" TEXT,
  ADD COLUMN "pastDueSince" TIMESTAMP(3);

CREATE UNIQUE INDEX "shops_asaasCustomerId_key" ON "shops"("asaasCustomerId");
CREATE UNIQUE INDEX "shops_asaasSubscriptionId_key" ON "shops"("asaasSubscriptionId");
CREATE INDEX "shops_subscriptionStatus_pastDueSince_idx" ON "shops"("subscriptionStatus", "pastDueSince");

CREATE TABLE "billing_events" (
    "id" TEXT NOT NULL,
    "event" TEXT NOT NULL,
    "paymentId" TEXT,
    "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "billing_events_pkey" PRIMARY KEY ("id")
);
