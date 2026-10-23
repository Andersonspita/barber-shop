import { InjectQueue, Processor, WorkerHost } from '@nestjs/bullmq';
import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { Job, Queue } from 'bullmq';
import { BillingService } from './billing.service';

export const BILLING_QUEUE = 'billing-queue';
const SUSPEND_JOB = 'suspend-overdue';

/** Roda de hora em hora (aos 30 min, longe dos outros jobs). */
@Injectable()
export class BillingScheduler implements OnModuleInit {
  private readonly logger = new Logger(BillingScheduler.name);

  constructor(@InjectQueue(BILLING_QUEUE) private readonly queue: Queue) {}

  async onModuleInit() {
    try {
      await this.queue.add(
        SUSPEND_JOB,
        {},
        {
          repeat: { pattern: '30 * * * *' },
          jobId: SUSPEND_JOB,
          removeOnComplete: 50,
          removeOnFail: 50,
        },
      );
    } catch (error) {
      this.logger.error(
        `Não foi possível agendar a suspensão por inadimplência: ${String(error)}`,
      );
    }
  }
}

/** Suspende barbearias com mensalidade vencida além da tolerância. */
@Processor(BILLING_QUEUE)
export class BillingLifecycleProcessor extends WorkerHost {
  constructor(private readonly billing: BillingService) {
    super();
  }

  async process(job: Job): Promise<void> {
    if (job.name !== SUSPEND_JOB) return;
    await this.billing.suspendOverdue(new Date());
  }
}
