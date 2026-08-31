import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { Logger } from '@nestjs/common';
import { WHATSAPP_QUEUE, WhatsappJob } from './notifications.service';
import { WhatsappClient } from './whatsapp.client';

/**
 * A mensagem já chega pronta da fila. O worker só entrega — e deixa o erro
 * subir para o BullMQ reprocessar com backoff.
 */
@Processor(WHATSAPP_QUEUE)
export class NotificationsProcessor extends WorkerHost {
  private readonly logger = new Logger(NotificationsProcessor.name);

  constructor(private readonly whatsapp: WhatsappClient) {
    super();
  }

  async process(job: Job<WhatsappJob>): Promise<void> {
    const { kind, to, message, appointmentId } = job.data;

    await this.whatsapp.sendText(to, message);

    this.logger.log(
      `Mensagem "${kind}" entregue${appointmentId ? ` (agendamento ${appointmentId})` : ''}.`,
    );
  }
}
