-- AlterTable: User ganha foto, bio, status e troca obrigatória de senha
ALTER TABLE "User" ADD COLUMN     "isActive" BOOLEAN NOT NULL DEFAULT true,
                   ADD COLUMN     "photoUrl" TEXT,
                   ADD COLUMN     "bio" TEXT,
                   ADD COLUMN     "mustChangePassword" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable: Service ganha descrição própria e desativação
ALTER TABLE "Service" ADD COLUMN     "description" TEXT,
                      ADD COLUMN     "isActive" BOOLEAN NOT NULL DEFAULT true;

-- AlterTable: Appointment ganha valor congelado, observação, autoria e cancelamento
ALTER TABLE "Appointment" ADD COLUMN     "priceCharged" DECIMAL(10,2),
                          ADD COLUMN     "notes" TEXT,
                          ADD COLUMN     "createdById" TEXT,
                          ADD COLUMN     "cancelledAt" TIMESTAMP(3);

-- Agendamentos já existentes herdam o preço atual do serviço.
UPDATE "Appointment" a SET "priceCharged" = s."price"
FROM "Service" s WHERE s."id" = a."serviceId" AND a."priceCharged" IS NULL;

ALTER TABLE "Appointment" ALTER COLUMN "priceCharged" SET NOT NULL;

-- CreateTable
CREATE TABLE "BarberService" (
    "id" TEXT NOT NULL,
    "barberId" TEXT NOT NULL,
    "serviceId" TEXT NOT NULL,
    "priceOverride" DECIMAL(10,2),
    "durationMinutesOverride" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BarberService_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorkingHours" (
    "id" TEXT NOT NULL,
    "barberId" TEXT NOT NULL,
    "weekday" INTEGER NOT NULL,
    "startMinute" INTEGER NOT NULL,
    "endMinute" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WorkingHours_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Holiday" (
    "id" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "description" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Holiday_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "shop_settings" (
    "id" TEXT NOT NULL DEFAULT 'default',
    "name" TEXT NOT NULL DEFAULT 'Gerente Barber',
    "timezone" TEXT NOT NULL DEFAULT 'America/Sao_Paulo',
    "slotIntervalMinutes" INTEGER NOT NULL DEFAULT 30,
    "minAdvanceMinutes" INTEGER NOT NULL DEFAULT 30,
    "maxAdvanceDays" INTEGER NOT NULL DEFAULT 60,
    "cancellationWindowMinutes" INTEGER NOT NULL DEFAULT 120,
    "addressLine" TEXT,
    "city" TEXT,
    "mapsUrl" TEXT,
    "phone" TEXT,
    "whatsapp" TEXT,
    "instagram" TEXT,
    "about" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "shop_settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PasswordResetToken" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PasswordResetToken_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Review" (
    "id" TEXT NOT NULL,
    "appointmentId" TEXT NOT NULL,
    "rating" INTEGER NOT NULL,
    "comment" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Review_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WaitlistEntry" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "serviceId" TEXT NOT NULL,
    "barberId" TEXT,
    "date" DATE NOT NULL,
    "notifiedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WaitlistEntry_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "User_role_isActive_idx" ON "User"("role", "isActive");

-- CreateIndex
CREATE INDEX "User_birthDate_idx" ON "User"("birthDate");

-- CreateIndex
CREATE INDEX "Service_isActive_idx" ON "Service"("isActive");

-- CreateIndex
CREATE INDEX "Appointment_clientId_startTime_idx" ON "Appointment"("clientId", "startTime");

-- CreateIndex
CREATE INDEX "Appointment_status_startTime_idx" ON "Appointment"("status", "startTime");

-- CreateIndex
CREATE INDEX "ScheduleBlock_barberId_startTime_endTime_idx" ON "ScheduleBlock"("barberId", "startTime", "endTime");

-- CreateIndex
CREATE UNIQUE INDEX "BarberService_barberId_serviceId_key" ON "BarberService"("barberId", "serviceId");

-- CreateIndex
CREATE INDEX "BarberService_serviceId_idx" ON "BarberService"("serviceId");

-- CreateIndex
CREATE UNIQUE INDEX "WorkingHours_barberId_weekday_startMinute_key" ON "WorkingHours"("barberId", "weekday", "startMinute");

-- CreateIndex
CREATE INDEX "WorkingHours_barberId_weekday_idx" ON "WorkingHours"("barberId", "weekday");

-- CreateIndex
CREATE UNIQUE INDEX "Holiday_date_key" ON "Holiday"("date");

-- CreateIndex
CREATE UNIQUE INDEX "PasswordResetToken_tokenHash_key" ON "PasswordResetToken"("tokenHash");

-- CreateIndex
CREATE INDEX "PasswordResetToken_userId_idx" ON "PasswordResetToken"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Review_appointmentId_key" ON "Review"("appointmentId");

-- CreateIndex
CREATE UNIQUE INDEX "WaitlistEntry_clientId_serviceId_date_key" ON "WaitlistEntry"("clientId", "serviceId", "date");

-- CreateIndex
CREATE INDEX "WaitlistEntry_date_notifiedAt_idx" ON "WaitlistEntry"("date", "notifiedAt");

-- AddForeignKey
ALTER TABLE "Appointment" ADD CONSTRAINT "Appointment_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BarberService" ADD CONSTRAINT "BarberService_barberId_fkey" FOREIGN KEY ("barberId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BarberService" ADD CONSTRAINT "BarberService_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "Service"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkingHours" ADD CONSTRAINT "WorkingHours_barberId_fkey" FOREIGN KEY ("barberId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PasswordResetToken" ADD CONSTRAINT "PasswordResetToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Review" ADD CONSTRAINT "Review_appointmentId_fkey" FOREIGN KEY ("appointmentId") REFERENCES "Appointment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WaitlistEntry" ADD CONSTRAINT "WaitlistEntry_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WaitlistEntry" ADD CONSTRAINT "WaitlistEntry_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "Service"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WaitlistEntry" ADD CONSTRAINT "WaitlistEntry_barberId_fkey" FOREIGN KEY ("barberId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- DropForeignKey: ScheduleBlock passa a acompanhar a exclusão do barbeiro
ALTER TABLE "ScheduleBlock" DROP CONSTRAINT "ScheduleBlock_barberId_fkey";

-- AddForeignKey
ALTER TABLE "ScheduleBlock" ADD CONSTRAINT "ScheduleBlock_barberId_fkey" FOREIGN KEY ("barberId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Configuração inicial da barbearia
INSERT INTO "shop_settings" ("id", "updatedAt") VALUES ('default', CURRENT_TIMESTAMP)
    ON CONFLICT ("id") DO NOTHING;

-- Jornada padrão para os barbeiros já cadastrados: segunda a sexta 09:00-18:00,
-- sábado 09:00-14:00. Preserva o comportamento anterior sem o domingo aberto.
INSERT INTO "WorkingHours" ("id", "barberId", "weekday", "startMinute", "endMinute", "createdAt")
SELECT gen_random_uuid()::text, u."id", d."weekday", 540, 1080, CURRENT_TIMESTAMP
FROM "User" u
CROSS JOIN (VALUES (1), (2), (3), (4), (5)) AS d("weekday")
WHERE u."role" = 'BARBER'
ON CONFLICT DO NOTHING;

INSERT INTO "WorkingHours" ("id", "barberId", "weekday", "startMinute", "endMinute", "createdAt")
SELECT gen_random_uuid()::text, u."id", 6, 540, 840, CURRENT_TIMESTAMP
FROM "User" u
WHERE u."role" = 'BARBER'
ON CONFLICT DO NOTHING;
