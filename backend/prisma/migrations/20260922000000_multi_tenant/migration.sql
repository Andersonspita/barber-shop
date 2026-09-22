-- Multi-tenant: uma instalação passa a atender várias barbearias.
--
-- A configuração única (`shop_settings`, linha "default") vira a tabela de
-- barbearias, e tudo o que já existe na base é atribuído a ela. Nenhum dado é
-- apagado: uma instalação que já está no ar continua funcionando como a
-- primeira barbearia da plataforma, no endereço /<slug> abaixo.

-- ------------------------------------------------------------- barbearias

ALTER TABLE "shop_settings" RENAME TO "shops";
ALTER TABLE "shops" RENAME CONSTRAINT "shop_settings_pkey" TO "shops_pkey";
ALTER TABLE "shops" ALTER COLUMN "id" DROP DEFAULT;

ALTER TABLE "shops"
  ADD COLUMN "slug" TEXT,
  ADD COLUMN "isActive" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN "whatsappInstance" TEXT,
  ADD COLUMN "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- A linha de configuração era criada sob demanda pela API. Garante que ela
-- exista, porque agora os dados antigos precisam de uma barbearia para apontar.
INSERT INTO "shops" ("id", "updatedAt")
VALUES ('default', CURRENT_TIMESTAMP)
ON CONFLICT ("id") DO NOTHING;

UPDATE "shops" SET "slug" = 'principal' WHERE "slug" IS NULL;
ALTER TABLE "shops" ALTER COLUMN "slug" SET NOT NULL;
CREATE UNIQUE INDEX "shops_slug_key" ON "shops"("slug");

-- --------------------------------------------- shopId nas tabelas de dados

ALTER TABLE "User" ADD COLUMN "shopId" TEXT;
ALTER TABLE "Service" ADD COLUMN "shopId" TEXT;
ALTER TABLE "Appointment" ADD COLUMN "shopId" TEXT;
ALTER TABLE "Holiday" ADD COLUMN "shopId" TEXT;
ALTER TABLE "WaitlistEntry" ADD COLUMN "shopId" TEXT;

UPDATE "User" SET "shopId" = 'default' WHERE "shopId" IS NULL;
UPDATE "Service" SET "shopId" = 'default' WHERE "shopId" IS NULL;
UPDATE "Appointment" SET "shopId" = 'default' WHERE "shopId" IS NULL;
UPDATE "Holiday" SET "shopId" = 'default' WHERE "shopId" IS NULL;
UPDATE "WaitlistEntry" SET "shopId" = 'default' WHERE "shopId" IS NULL;

ALTER TABLE "User" ALTER COLUMN "shopId" SET NOT NULL;
ALTER TABLE "Service" ALTER COLUMN "shopId" SET NOT NULL;
ALTER TABLE "Appointment" ALTER COLUMN "shopId" SET NOT NULL;
ALTER TABLE "Holiday" ALTER COLUMN "shopId" SET NOT NULL;
ALTER TABLE "WaitlistEntry" ALTER COLUMN "shopId" SET NOT NULL;

-- ------------------------------------------------ unicidade por barbearia

-- O mesmo e-mail pode ter conta em barbearias diferentes.
DROP INDEX "User_email_key";
CREATE UNIQUE INDEX "User_shopId_email_key" ON "User"("shopId", "email");

-- Duas barbearias podem fechar no mesmo feriado.
DROP INDEX "Holiday_date_key";
CREATE UNIQUE INDEX "Holiday_shopId_date_key" ON "Holiday"("shopId", "date");

-- ----------------------------------------- índices com o shopId à frente

DROP INDEX "User_role_isActive_idx";
CREATE INDEX "User_shopId_role_isActive_idx" ON "User"("shopId", "role", "isActive");

DROP INDEX "Service_isActive_idx";
CREATE INDEX "Service_shopId_isActive_idx" ON "Service"("shopId", "isActive");

CREATE INDEX "Appointment_shopId_startTime_idx" ON "Appointment"("shopId", "startTime");

DROP INDEX "WaitlistEntry_date_notifiedAt_idx";
CREATE INDEX "WaitlistEntry_shopId_date_notifiedAt_idx" ON "WaitlistEntry"("shopId", "date", "notifiedAt");

-- ---------------------------------------------------------- chaves estrangeiras

-- RESTRICT: apagar uma barbearia com dados precisa ser uma decisão explícita,
-- nunca um efeito colateral em cascata.
ALTER TABLE "User" ADD CONSTRAINT "User_shopId_fkey" FOREIGN KEY ("shopId") REFERENCES "shops"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Service" ADD CONSTRAINT "Service_shopId_fkey" FOREIGN KEY ("shopId") REFERENCES "shops"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Appointment" ADD CONSTRAINT "Appointment_shopId_fkey" FOREIGN KEY ("shopId") REFERENCES "shops"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Holiday" ADD CONSTRAINT "Holiday_shopId_fkey" FOREIGN KEY ("shopId") REFERENCES "shops"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "WaitlistEntry" ADD CONSTRAINT "WaitlistEntry_shopId_fkey" FOREIGN KEY ("shopId") REFERENCES "shops"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
