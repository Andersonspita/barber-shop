import { Module } from '@nestjs/common';
import { ScheduleBlocksController } from './schedule-blocks.controller';
import { ScheduleBlocksService } from './schedule-blocks.service';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [ScheduleBlocksController],
  providers: [ScheduleBlocksService],
})
export class ScheduleBlocksModule {}
