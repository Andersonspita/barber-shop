import { InjectQueue, Processor, WorkerHost } from '@nestjs/bullmq';
import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { Job, Queue } from 'bullmq';
import { addHours } from 'date-fns';
import { formatInTimeZone } from 'date-fns-tz';
import { PrismaService } from '../prisma/prisma.service';
import { ShopSettingsService } from '../shop/shop-settings.service';
import { NotificationsService } from '../notifications/notifications.service';
import { SdrWebhookService } from './sdr-webhook.service';

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
 * Teste grátis vencendo: avisa o dono 48h antes e, no vencimento, tira a
 * barbearia do ar (EXPIRED + suspensa). Os dados ficam: ativar o plano na
 * plataforma devolve tudo como estava.
 */
@Processor(TRIAL_LIFECYCLE_QUEUE)
export class TrialLifecycleProcessor extends WorkerHost {
  private readonly logger = new Logger(TrialLifecycleProcessor.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly shops: ShopSettingsService,
    private readonly notifications: NotificationsService,
    private readonly webhooks: SdrWebhookService,
  ) {
    super();
  }

  async process(job: Job): Promise<void> {
    if (job.name !== LIFECYCLE_JOB) return;
    await this.run(new Date());
  }

  /** Público para os testes rodarem o ciclo num instante escolhido. */
  async run(now: Date): Promise<{ reminded: number; expired: number }> {
    const reminded = await this.sendReminders(now);
    const expired = await this.expire(now);
    return { reminded, expired };
  }

  private async sendReminders(now: Date): Promise<number> {
    const shops = await this.prisma.shop.findMany({
      where: {
        subscriptionStatus: 'TRIAL',
        trialReminderSentAt: null,
        trialEndsAt: { gt: now, lte: addHours(now, REMINDER_HOURS_BEFORE) },
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

        const when = formatInTimeZone(
          shop.trialEndsAt!,
          shop.timezone,
          "dd/MM 'às' HH:mm",
        );
        await this.notifyOwner(
          shop.id,
          `Seu teste grátis da ${shop.name} no Gerente Barber termina em ${when}.\n\n` +
            `Para continuar com a agenda online e os lembretes no WhatsApp, é só responder esta mensagem que a gente ativa o seu plano.`,
        );
        await this.webhooks.emit('trial.expiring', shop);
        reminded++;
      } catch (error) {
        this.logger.error(
          `Aviso de fim de teste da ${shop.slug} falhou: ${String(error)}`,
        );
      }
    }
    return reminded;
  }

  private async expire(now: Date): Promise<number> {
    const shops = await this.prisma.shop.findMany({
      where: { subscriptionStatus: 'TRIAL', trialEndsAt: { lte: now } },
      select: { id: true, slug: true },
    });

    let expired = 0;
    for (const { id, slug } of shops) {
      try {
        const { count } = await this.prisma.shop.updateMany({
          where: { id, subscriptionStatus: 'TRIAL' },
          data: { subscriptionStatus: 'EXPIRED', isActive: false },
        });
        if (count === 0) continue;

        // Vitrine e sessões caem já, não quando o cache de 30 s vencer.
        this.shops.forget(id);
        const shop = await this.prisma.shop.findUniqueOrThrow({
          where: { id },
        });
        await this.notifyOwner(
          id,
          `O teste grátis da ${shop.name} terminou e a página saiu do ar.\n\n` +
            `Seus clientes, serviços e horários continuam guardados. Responda esta mensagem para ativar o plano e voltar ao ar na hora.`,
        );
        await this.webhooks.emit('trial.expired', shop);
        expired++;
        this.logger.log(`Teste grátis vencido: ${slug}`);
      } catch (error) {
        this.logger.error(
          `Expiração do teste da ${slug} falhou: ${String(error)}`,
        );
      }
    }
    return expired;
  }

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
    await this.notifications.trialNotice(
      shopId,
      owner?.phoneNumber ?? '',
      message,
    );
  }
}
