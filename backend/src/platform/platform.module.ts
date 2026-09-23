import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import {
  PlatformBillingController,
  PlatformController,
} from './platform.controller';

@Module({
  imports: [PrismaModule],
  controllers: [PlatformController, PlatformBillingController],
})
export class PlatformModule {}
