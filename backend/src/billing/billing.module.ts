import { Global, Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { PrismaModule } from '../prisma/prisma.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { BillingService } from './billing.service';
import { BillingController } from './billing.controller';
import {
  BILLING_QUEUE,
  BillingProcessor,
  BillingScheduler,
} from './billing.processor';

/**
 * Global porque o limite de profissionais, a pausa do agendamento e a
 * plataforma consultam a cobrança de módulos diferentes.
 */
@Global()
@Module({
  imports: [
    PrismaModule,
    NotificationsModule,
    BullModule.registerQueue({ name: BILLING_QUEUE }),
  ],
  controllers: [BillingController],
  providers: [BillingService, BillingScheduler, BillingProcessor],
  exports: [BillingService],
})
export class BillingModule {}
