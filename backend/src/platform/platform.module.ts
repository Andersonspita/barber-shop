import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { TrialEventsModule } from '../trial/trial-events.module';
import { PlatformController } from './platform.controller';

@Module({
  imports: [PrismaModule, TrialEventsModule],
  controllers: [PlatformController],
})
export class PlatformModule {}
