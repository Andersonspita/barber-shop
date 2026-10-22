import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { PrismaModule } from '../prisma/prisma.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { TrialEventsModule } from './trial-events.module';
import { ProvisioningController } from './provisioning.controller';
import { ProvisioningGuard } from './provisioning.guard';
import { TrialProvisioningService } from './trial-provisioning.service';
import {
  TRIAL_LIFECYCLE_QUEUE,
  TrialLifecycleProcessor,
  TrialLifecycleScheduler,
} from './trial-lifecycle.processor';

/** Teste grátis: provisionamento pelo SDR-AI e ciclo de vida até virar plano. */
@Module({
  imports: [
    PrismaModule,
    NotificationsModule,
    TrialEventsModule,
    BullModule.registerQueue({ name: TRIAL_LIFECYCLE_QUEUE }),
  ],
  controllers: [ProvisioningController],
  providers: [
    ProvisioningGuard,
    TrialProvisioningService,
    TrialLifecycleScheduler,
    TrialLifecycleProcessor,
  ],
  exports: [TrialLifecycleProcessor],
})
export class TrialModule {}
