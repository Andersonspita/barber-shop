import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { TrialEventsModule } from '../trial/trial-events.module';
import { BillingModule } from '../billing/billing.module';
import { PlatformController } from './platform.controller';

@Module({
  imports: [PrismaModule, TrialEventsModule, BillingModule],
  controllers: [PlatformController],
})
export class PlatformModule {}
