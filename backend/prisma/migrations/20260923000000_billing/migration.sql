-- Mensalidade das barbearias: planos por número de profissionais e faturas
-- mensais, com baixa manual (sem operadora de pagamento, por enquanto).

-- CreateEnum
CREATE TYPE "InvoiceStatus" AS ENUM ('OPEN', 'PAID', 'CANCELED');

-- AlterTable
ALTER TABLE "shops" ADD COLUMN     "billingExempt" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "planCode" TEXT,
ADD COLUMN     "trialEndsAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "plans" (
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "maxBarbers" INTEGER,
    "includedBarbers" INTEGER NOT NULL,
    "monthlyPrice" DECIMAL(10,2) NOT NULL,
    "extraBarberPrice" DECIMAL(10,2),
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "plans_pkey" PRIMARY KEY ("code")
);

-- CreateTable
CREATE TABLE "invoices" (
    "id" TEXT NOT NULL,
    "shopId" TEXT NOT NULL,
    "periodStart" TIMESTAMP(3) NOT NULL,
    "periodEnd" TIMESTAMP(3) NOT NULL,
    "dueDate" TIMESTAMP(3) NOT NULL,
    "planCode" TEXT NOT NULL,
    "planName" TEXT NOT NULL,
    "barbers" INTEGER NOT NULL,
    "amount" DECIMAL(10,2) NOT NULL,
    "status" "InvoiceStatus" NOT NULL DEFAULT 'OPEN',
    "paidAt" TIMESTAMP(3),
    "note" TEXT,
    "overdueNotifiedAt" TIMESTAMP(3),
    "blockedNotifiedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "invoices_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "invoices_status_dueDate_idx" ON "invoices"("status", "dueDate");

-- CreateIndex
CREATE UNIQUE INDEX "invoices_shopId_periodStart_key" ON "invoices"("shopId", "periodStart");

-- AddForeignKey
ALTER TABLE "shops" ADD CONSTRAINT "shops_planCode_fkey" FOREIGN KEY ("planCode") REFERENCES "plans"("code") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_shopId_fkey" FOREIGN KEY ("shopId") REFERENCES "shops"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- ------------------------------------------------------------------ planos
-- Preços iniciais. Podem ser alterados depois no painel /plataforma; cada
-- fatura guarda o valor da época, então a mudança só vale para as próximas.
INSERT INTO "plans" ("code", "name", "maxBarbers", "includedBarbers", "monthlyPrice", "extraBarberPrice", "sortOrder", "updatedAt") VALUES
  ('solo',         'Solo',         1,    1,  35.00,  NULL,  1, CURRENT_TIMESTAMP),
  ('essencial',    'Essencial',    3,    3,  89.90,  NULL,  2, CURRENT_TIMESTAMP),
  ('profissional', 'Profissional', 6,    6,  149.90, NULL,  3, CURRENT_TIMESTAMP),
  ('premium',      'Premium',      10,   10, 219.90, NULL,  4, CURRENT_TIMESTAMP),
  ('rede',         'Rede',         NULL, 10, 219.90, 19.90, 5, CURRENT_TIMESTAMP)
ON CONFLICT ("code") DO NOTHING;

-- ----------------------------------------- barbearias que já estavam no ar
-- Nada muda para elas sem decisão de quem opera a plataforma: entram como
-- cortesia (sem fatura e sem limite) e já com o plano que caberia na equipe
-- atual, para facilitar a troca quando for hora de cobrar.
UPDATE "shops" s SET
  "billingExempt" = true,
  "planCode" = CASE
    WHEN n.barbers <= 1  THEN 'solo'
    WHEN n.barbers <= 3  THEN 'essencial'
    WHEN n.barbers <= 6  THEN 'profissional'
    WHEN n.barbers <= 10 THEN 'premium'
    ELSE 'rede'
  END
FROM (
  SELECT sh."id", COUNT(u."id") AS barbers
  FROM "shops" sh
  LEFT JOIN "User" u ON u."shopId" = sh."id" AND u."role" = 'BARBER' AND u."isActive" = true
  GROUP BY sh."id"
) n
WHERE n."id" = s."id";
