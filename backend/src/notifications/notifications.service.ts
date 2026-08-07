import { Injectable } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';

import { differenceInMilliseconds, subHours } from 'date-fns';

export interface NotificationPayload {
  appointmentId: string;
  clientName: string;
  phone: string;
  serviceName: string;
  barberName: string;
  time: Date;
}

@Injectable()
export class NotificationsService {
  constructor(@InjectQueue('whatsapp-queue') private readonly whatsappQueue: Queue) {}

  async scheduleWhatsAppNotification(data: NotificationPayload) {
    // 1. Confirmação instantânea
    await this.whatsappQueue.add('send-confirmation', data, {
      attempts: 3,
      backoff: { type: 'exponential', delay: 1000 },
    });

    // 2. Lembrete com Delay (2 horas antes)
    const reminderTime = subHours(data.time, 2);
    const delay = differenceInMilliseconds(reminderTime, new Date());

    if (delay > 0) {
      await this.whatsappQueue.add('send-reminder', data, {
        delay,
        attempts: 3,
        backoff: { type: 'exponential', delay: 1000 },
      });
    }
  }
}
