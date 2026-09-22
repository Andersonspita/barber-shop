import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { Logger } from '@nestjs/common';
import { WHATSAPP_QUEUE, WhatsappJob } from './notifications.service';
import { WhatsappClient } from './whatsapp.client';
import { ShopSettingsService } from '../shop/shop-settings.service';

/**
 * A mensagem já chega pronta da fila. O worker só entrega — e deixa o erro
 * subir para o BullMQ reprocessar com backoff.
 */
@Processor(WHATSAPP_QUEUE)
export class NotificationsProcessor extends WorkerHost {
  private readonly logger = new Logger(NotificationsProcessor.name);

  constructor(
    private readonly whatsapp: WhatsappClient,
    private readonly shops: ShopSettingsService,
  ) {
    super();
  }

  async process(job: Job<WhatsappJob>): Promise<void> {
    const { kind, to, message, appointmentId, shopId } = job.data;

    // Jobs enfileirados antes do multi-tenant não têm shopId e saem pela
    // instância padrão, como saíam antes.
    const instance = shopId
      ? (await this.shops.get(shopId)).whatsappInstance
      : null;

    await this.whatsapp.sendText(to, message, instance);

    this.logger.log(
      `Mensagem "${kind}" entregue${appointmentId ? ` (agendamento ${appointmentId})` : ''}.`,
    );
  }
}
