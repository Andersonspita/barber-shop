-- Teste grátis provisionado pelo SDR-AI.
--
-- Barbearias que já existem continuam no ar: o status padrão é ACTIVE e
-- nenhuma delas ganha data de fim de teste.

CREATE TYPE "SubscriptionStatus" AS ENUM ('TRIAL', 'ACTIVE', 'EXPIRED');
CREATE TYPE "Plan" AS ENUM ('SOLO', 'SQUAD', 'PRO', 'EMPIRE');

ALTER TABLE "shops"
  ADD COLUMN "subscriptionStatus" "SubscriptionStatus" NOT NULL DEFAULT 'ACTIVE',
  ADD COLUMN "plan" "Plan",
  -- trialEndsAt já pode existir (criada pela migração da mensalidade, 20260923).
  ADD COLUMN IF NOT EXISTS "trialEndsAt" TIMESTAMP(3),
  ADD COLUMN "trialActivatedAt" TIMESTAMP(3),
  ADD COLUMN "trialReminderSentAt" TIMESTAMP(3),
  ADD COLUMN "externalLeadId" TEXT;

CREATE UNIQUE INDEX "shops_externalLeadId_key" ON "shops"("externalLeadId");
CREATE INDEX "shops_subscriptionStatus_trialEndsAt_idx" ON "shops"("subscriptionStatus", "trialEndsAt");
