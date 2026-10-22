import { InjectQueue, Processor, WorkerHost } from '@nestjs/bullmq';
import { Injectable, Logger } from '@nestjs/common';
import { Job, Queue } from 'bullmq';
import { createHmac, randomUUID } from 'node:crypto';

export const SDR_WEBHOOK_QUEUE = 'sdr-webhook-queue';

export type TrialEvent =
  | 'trial.activated'
  | 'trial.expiring'
  | 'trial.expired'
  | 'subscription.activated';

/** Recorte da barbearia que o SDR-AI precisa para atualizar o lead. */
export interface TrialShopSnapshot {
  id: string;
  slug: string;
  externalLeadId: string | null;
  subscriptionStatus: string;
  plan: string | null;
  trialEndsAt: Date | null;
}

export interface SdrWebhookPayload {
  id: string;
  event: TrialEvent;
  occurredAt: string;
  shop: Omit<TrialShopSnapshot, 'trialEndsAt'> & { trialEndsAt: string | null };
}

const JOB_OPTIONS = {
  attempts: 8,
  backoff: { type: 'exponential' as const, delay: 5_000 },
  removeOnComplete: 500,
  removeOnFail: 1_000,
};

/**
 * Avisa o SDR-AI sobre o ciclo de vida do teste grátis (ativou, vai vencer,
 * venceu, virou cliente). Só vale para barbearias que vieram do SDR
 * (`externalLeadId`) e só quando `SDR_WEBHOOK_URL` está configurado.
 *
 * O envio passa pela fila: o SDR fora do ar não pode travar o login nem o job
 * de expiração, e a entrega é refeita com espera exponencial.
 */
@Injectable()
export class SdrWebhookService {
  private readonly logger = new Logger(SdrWebhookService.name);

  constructor(
    @InjectQueue(SDR_WEBHOOK_QUEUE)
    private readonly queue: Queue<SdrWebhookPayload>,
  ) {}

  async emit(event: TrialEvent, shop: TrialShopSnapshot): Promise<void> {
    if (!shop.externalLeadId || !process.env.SDR_WEBHOOK_URL?.trim()) return;

    const payload: SdrWebhookPayload = {
      id: randomUUID(),
      event,
      occurredAt: new Date().toISOString(),
      // Campos listados um a um: a linha completa da barbearia não sai daqui.
      shop: {
        id: shop.id,
        slug: shop.slug,
        externalLeadId: shop.externalLeadId,
        subscriptionStatus: shop.subscriptionStatus,
        plan: shop.plan,
        trialEndsAt: shop.trialEndsAt ? shop.trialEndsAt.toISOString() : null,
      },
    };

    try {
      await this.queue.add(event, payload, {
        ...JOB_OPTIONS,
        jobId: `sdr-${payload.id}`,
      });
    } catch (error) {
      // Perder um aviso é melhor do que derrubar a operação que o gerou.
      this.logger.error(
        `Falha ao enfileirar "${event}" da barbearia ${shop.slug}: ${String(error)}`,
      );
    }
  }
}

/**
 * Assinatura HMAC-SHA256 de `${timestamp}.${corpo}`. O timestamp entra na
 * conta para o SDR recusar reenvios antigos (replay).
 */
export function signSdrWebhook(
  secret: string,
  timestamp: string,
  body: string,
): string {
  return createHmac('sha256', secret)
    .update(`${timestamp}.${body}`)
    .digest('hex');
}

@Processor(SDR_WEBHOOK_QUEUE)
export class SdrWebhookProcessor extends WorkerHost {
  private readonly logger = new Logger(SdrWebhookProcessor.name);

  async process(job: Job<SdrWebhookPayload>): Promise<void> {
    const url = process.env.SDR_WEBHOOK_URL?.trim();
    const secret = process.env.SDR_WEBHOOK_SECRET?.trim();
    if (!url || !secret) {
      this.logger.warn(
        `Aviso "${job.data.event}" descartado: SDR_WEBHOOK_URL/SDR_WEBHOOK_SECRET não configurados.`,
      );
      return;
    }

    const body = JSON.stringify(job.data);
    const timestamp = Math.floor(Date.now() / 1000).toString();
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Gerente-Barber-Event': job.data.event,
        'X-Gerente-Barber-Timestamp': timestamp,
        'X-Gerente-Barber-Signature': `sha256=${signSdrWebhook(secret, timestamp, body)}`,
      },
      body,
      signal: AbortSignal.timeout(10_000),
    });

    if (!response.ok) {
      // Erro faz o BullMQ tentar de novo com a espera configurada.
      throw new Error(
        `SDR respondeu ${response.status} para "${job.data.event}"`,
      );
    }
  }
}
