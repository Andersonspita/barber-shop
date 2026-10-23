import { InjectQueue, Processor, WorkerHost } from '@nestjs/bullmq';
import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { Job, Queue } from 'bullmq';
import { addHours } from 'date-fns';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { BillingService } from '../billing/billing.service';
import { notifiesThroughSdr } from './sdr-webhook.service';

export const TRIAL_LIFECYCLE_QUEUE = 'trial-lifecycle-queue';
const LIFECYCLE_JOB = 'trial-lifecycle';
/** Antecedência do aviso de "seu teste acaba em breve". */
const REMINDER_HOURS_BEFORE = 48;

/** Roda de hora em hora (aos 15 min, longe do job de aniversários). */
@Injectable()
export class TrialLifecycleScheduler implements OnModuleInit {
  private readonly logger = new Logger(TrialLifecycleScheduler.name);

  constructor(
    @InjectQueue(TRIAL_LIFECYCLE_QUEUE) private readonly queue: Queue,
  ) {}

  async onModuleInit() {
    try {
      await this.queue.add(
        LIFECYCLE_JOB,
        {},
        {
          repeat: { pattern: '15 * * * *' },
          jobId: LIFECYCLE_JOB,
          removeOnComplete: 50,
          removeOnFail: 50,
        },
      );
    } catch (error) {
      this.logger.error(
        `Não foi possível agendar o ciclo de vida dos testes: ${String(error)}`,
      );
    }
  }
}

/**
 * Teste grátis acabando: avisa o dono 48h antes. O vencimento em si é da
 * cobrança — a 1ª fatura vence no fim do teste e, sem pagamento, o
 * agendamento online pausa depois da tolerância. Nada sai do ar aqui.
 */
@Processor(TRIAL_LIFECYCLE_QUEUE)
export class TrialLifecycleProcessor extends WorkerHost {
  private readonly logger = new Logger(TrialLifecycleProcessor.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
    private readonly billing: BillingService,
  ) {
    super();
  }

  async process(job: Job): Promise<void> {
    if (job.name !== LIFECYCLE_JOB) return;
    await this.run(new Date());
  }

  /** Público para os testes rodarem o ciclo num instante escolhido. */
  async run(now: Date): Promise<{ reminded: number }> {
    return { reminded: await this.sendReminders(now) };
  }

  private async sendReminders(now: Date): Promise<number> {
    const shops = await this.prisma.shop.findMany({
      where: {
        isActive: true,
        billingExempt: false,
        trialReminderSentAt: null,
        trialEndsAt: { gt: now, lte: addHours(now, REMINDER_HOURS_BEFORE) },
        // Quem já pagou não está mais "em teste".
        invoices: { none: { status: 'PAID' } },
      },
    });

    let reminded = 0;
    for (const shop of shops) {
      try {
        const { count } = await this.prisma.shop.updateMany({
          where: { id: shop.id, trialReminderSentAt: null },
          data: { trialReminderSentAt: now },
        });
        if (count === 0) continue;

        if (notifiesThroughSdr(shop)) {
          await this.billing.emitToSdr('trial.expiring', shop.id, now);
        } else {
          await this.notifyOwner(
            shop.id,
            `Seu teste grátis da ${shop.name} no Gerente Barber termina em ${formatDay(shop.trialEndsAt!)}.

` +
              `Para continuar com a agenda online e os lembretes no WhatsApp, é só pagar a primeira mensalidade — ela está em Assinatura, no painel.`,
          );
        }
        reminded++;
      } catch (error) {
        this.logger.error(
          `Aviso de fim de teste da ${shop.slug} falhou: ${String(error)}`,
        );
      }
    }
    return reminded;
  }

  /** Aviso pelo WhatsApp da plataforma — só para barbearias que não vieram do SDR. */
  private async notifyOwner(shopId: string, message: string) {
    const owner = await this.prisma.user.findFirst({
      where: {
        shopId,
        isAdmin: true,
        isActive: true,
        phoneNumber: { not: null },
      },
      orderBy: { createdAt: 'asc' },
      select: { phoneNumber: true },
    });
    if (!owner?.phoneNumber) return;
    await this.notifications.trialNotice(shopId, owner.phoneNumber, message);
  }
}

/** O fim do teste é um dia (gravado à meia-noite UTC), sem horário. */
function formatDay(date: Date): string {
  const [, m, d] = date.toISOString().slice(0, 10).split('-');
  return `${d}/${m}`;
}
