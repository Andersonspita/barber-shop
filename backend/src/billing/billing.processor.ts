import { InjectQueue, Processor, WorkerHost } from '@nestjs/bullmq';
import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { Job, Queue } from 'bullmq';
import { BillingService } from './billing.service';

export const BILLING_QUEUE = 'billing-queue';
const BILLING_JOB = 'billing-hourly';

/**
 * Agenda a rotina de cobrança de hora em hora. Ela é idempotente — a mesma
 * competência não gera duas faturas e cada aviso fica marcado na fatura —,
 * então rodar mais vezes do que o necessário não tem efeito colateral.
 */
@Injectable()
export class BillingScheduler implements OnModuleInit {
  private readonly logger = new Logger(BillingScheduler.name);

  constructor(@InjectQueue(BILLING_QUEUE) private readonly queue: Queue) {}

  async onModuleInit() {
    try {
      await this.queue.add(
        BILLING_JOB,
        {},
        {
          repeat: { pattern: '15 * * * *' },
          jobId: BILLING_JOB,
          removeOnComplete: 50,
          removeOnFail: 50,
        },
      );
    } catch (error) {
      this.logger.error(
        `Não foi possível agendar a rotina de cobrança: ${String(error)}`,
      );
    }
  }
}

@Processor(BILLING_QUEUE)
export class BillingProcessor extends WorkerHost {
  constructor(private readonly billing: BillingService) {
    super();
  }

  async process(job: Job): Promise<void> {
    if (job.name !== BILLING_JOB) return;
    await this.billing.runDaily();
  }
}
