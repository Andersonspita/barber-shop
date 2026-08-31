import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { PrismaModule } from '../prisma/prisma.module';
import { NotificationsService, WHATSAPP_QUEUE } from './notifications.service';
import { NotificationsProcessor } from './notifications.processor';
import {
  BirthdayScheduler,
  MAINTENANCE_QUEUE,
  MaintenanceProcessor,
} from './birthdays.processor';
import { WhatsappClient } from './whatsapp.client';

@Module({
  imports: [
    PrismaModule,
    BullModule.registerQueue(
      { name: WHATSAPP_QUEUE },
      { name: MAINTENANCE_QUEUE },
    ),
  ],
  providers: [
    NotificationsService,
    NotificationsProcessor,
    WhatsappClient,
    BirthdayScheduler,
    MaintenanceProcessor,
  ],
  exports: [NotificationsService],
})
export class NotificationsModule {}
