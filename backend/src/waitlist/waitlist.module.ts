import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { WaitlistController } from './waitlist.controller';

@Module({
  imports: [PrismaModule],
  controllers: [WaitlistController],
})
export class WaitlistModule {}
