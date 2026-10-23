import { Global, Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { PrismaModule } from '../prisma/prisma.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { TrialEventsModule } from '../trial/trial-events.module';
import { AsaasClient } from './asaas.client';
import { BillingService } from './billing.service';
import {
  AsaasWebhookController,
  BillingController,
} from './billing.controller';
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
    TrialEventsModule,
    BullModule.registerQueue({ name: BILLING_QUEUE }),
  ],
  controllers: [BillingController, AsaasWebhookController],
  providers: [AsaasClient, BillingService, BillingScheduler, BillingProcessor],
  exports: [BillingService],
})
export class BillingModule {}
