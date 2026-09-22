import { Processor, WorkerHost } from '@nestjs/bullmq';
import { InjectQueue } from '@nestjs/bullmq';
import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { Job, Queue } from 'bullmq';
import { formatInTimeZone } from 'date-fns-tz';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from './notifications.service';

export const MAINTENANCE_QUEUE = 'maintenance-queue';
const BIRTHDAY_JOB = 'birthday-greetings';
const GREETING_HOUR = Number(process.env.BIRTHDAY_GREETING_HOUR ?? 9);

/**
 * `birthDate` já era coletado no cadastro e em nenhum momento lido. Este job
 * roda de hora em hora e, para cada barbearia, dispara as felicitações quando
 * bate a hora escolhida no fuso dela — barbearias em fusos diferentes recebem
 * a mensagem na mesma hora local.
 */
@Injectable()
export class BirthdayScheduler implements OnModuleInit {
  private readonly logger = new Logger(BirthdayScheduler.name);

  constructor(@InjectQueue(MAINTENANCE_QUEUE) private readonly queue: Queue) {}

  async onModuleInit() {
    try {
      await this.queue.add(
        BIRTHDAY_JOB,
        {},
        {
          repeat: { pattern: '0 * * * *' },
          jobId: BIRTHDAY_JOB,
          removeOnComplete: 50,
          removeOnFail: 50,
        },
      );
    } catch (error) {
      this.logger.error(
        `Não foi possível agendar as felicitações de aniversário: ${String(error)}`,
      );
    }
  }
}

@Processor(MAINTENANCE_QUEUE)
export class MaintenanceProcessor extends WorkerHost {
  private readonly logger = new Logger(MaintenanceProcessor.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
  ) {
    super();
  }

  async process(job: Job): Promise<void> {
    if (job.name !== BIRTHDAY_JOB) return;

    const shops = await this.prisma.shop.findMany({
      where: { isActive: true },
      select: { id: true, timezone: true },
    });

    const now = new Date();
    for (const shop of shops) {
      try {
        await this.greetShop(shop.id, shop.timezone, now);
      } catch (error) {
        // Uma barbearia com fuso inválido não pode impedir as outras.
        this.logger.error(
          `Aniversários da barbearia ${shop.id} falharam: ${String(error)}`,
        );
      }
    }
  }

  private async greetShop(shopId: string, timezone: string, now: Date) {
    const localHour = Number(formatInTimeZone(now, timezone, 'H'));
    if (localHour !== GREETING_HOUR) return;

    const monthDay = formatInTimeZone(now, timezone, 'MM-dd');

    // `birthDate` guarda o ano de nascimento, então o filtro é por mês e dia.
    const clients = await this.prisma.$queryRaw<
      Array<{ name: string; phoneNumber: string | null }>
    >`
      SELECT "name", "phoneNumber"
      FROM "User"
      WHERE "shopId" = ${shopId}
        AND "role" = 'CLIENT'
        AND "isActive" = true
        AND "birthDate" IS NOT NULL
        AND "phoneNumber" IS NOT NULL
        AND to_char("birthDate", 'MM-DD') = ${monthDay}
    `;

    for (const client of clients) {
      await this.notifications.birthdayGreeting(shopId, client);
    }

    if (clients.length > 0) {
      this.logger.log(
        `${clients.length} felicitação(ões) de aniversário enfileirada(s) na barbearia ${shopId}.`,
      );
    }
  }
}
