import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { PrismaModule } from '../prisma/prisma.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { TrialEventsModule } from '../trial/trial-events.module';
import { AsaasClient } from './asaas.client';
import { BillingController } from './billing.controller';
import { BillingService } from './billing.service';
import {
  BILLING_QUEUE,
  BillingLifecycleProcessor,
  BillingScheduler,
} from './billing-lifecycle.processor';

/** Cobrança recorrente pelo Asaas: assinatura, webhook e inadimplência. */
@Module({
  imports: [
    PrismaModule,
    NotificationsModule,
    TrialEventsModule,
    BullModule.registerQueue({ name: BILLING_QUEUE }),
  ],
  controllers: [BillingController],
  providers: [
    AsaasClient,
    BillingService,
    BillingScheduler,
    BillingLifecycleProcessor,
  ],
  exports: [BillingService],
})
export class BillingModule {}
