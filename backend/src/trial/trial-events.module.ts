import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { PrismaModule } from '../prisma/prisma.module';
import {
  SDR_WEBHOOK_QUEUE,
  SdrWebhookProcessor,
  SdrWebhookService,
} from './sdr-webhook.service';
import { TrialActivationService } from './trial-activation.service';

/**
 * Eventos do teste grátis, separados do provisionamento para que o módulo de
 * autenticação possa usá-los sem depender dele (evita importação circular).
 */
@Module({
  imports: [
    PrismaModule,
    BullModule.registerQueue({ name: SDR_WEBHOOK_QUEUE }),
  ],
  providers: [SdrWebhookService, SdrWebhookProcessor, TrialActivationService],
  exports: [SdrWebhookService, TrialActivationService],
})
export class TrialEventsModule {}
