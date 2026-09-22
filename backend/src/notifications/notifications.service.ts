import { Injectable, Logger } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { differenceInMilliseconds, subHours } from 'date-fns';
import { ShopSettingsService } from '../shop/shop-settings.service';
import { shopDateOnly, shopHourLabel } from '../common/time.util';

export const WHATSAPP_QUEUE = 'whatsapp-queue';

export interface WhatsappJob {
  kind:
    | 'confirmation'
    | 'reminder'
    | 'cancellation'
    | 'reschedule'
    | 'waitlist'
    | 'birthday'
    | 'platform';
  /**
   * Define por qual número de WhatsApp a mensagem sai. Vazio nas mensagens da
   * própria plataforma (mensalidade), que saem pelo número padrão.
   */
  shopId?: string;
  to: string;
  message: string;
  appointmentId?: string;
}

interface AppointmentLike {
  id: string;
  shopId: string;
  startTime: Date;
  client: { name: string; phoneNumber: string | null } | null;
  barber: { name: string } | null;
  service: { name: string } | null;
}

const JOB_OPTIONS = {
  attempts: 5,
  backoff: { type: 'exponential' as const, delay: 2_000 },
  removeOnComplete: 500,
  removeOnFail: 1_000,
};

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);
  private readonly reminderHoursBefore = Number(
    process.env.REMINDER_HOURS_BEFORE ?? 2,
  );

  constructor(
    @InjectQueue(WHATSAPP_QUEUE) private readonly queue: Queue<WhatsappJob>,
    private readonly shop: ShopSettingsService,
  ) {}

  async appointmentConfirmed(appointment: AppointmentLike) {
    const { when, shopName } = await this.context(appointment);
    const phone = appointment.client?.phoneNumber;

    await this.enqueue({
      kind: 'confirmation',
      shopId: appointment.shopId,
      to: phone ?? '',
      appointmentId: appointment.id,
      message:
        `Olá, ${firstName(appointment.client?.name)}! Seu horário na ${shopName} está confirmado.\n\n` +
        `✂️ ${appointment.service?.name ?? 'Serviço'}\n` +
        `👤 ${appointment.barber?.name ?? 'Equipe'}\n` +
        `🗓️ ${when}\n\n` +
        `Se precisar remarcar, é só responder esta mensagem.`,
    });

    await this.scheduleReminder(appointment);
  }

  async appointmentRescheduled(
    appointment: AppointmentLike,
    previousStart: Date,
  ) {
    const { when, shopName, timezone } = await this.context(appointment);

    await this.cancelReminder(appointment.id);
    await this.enqueue({
      kind: 'reschedule',
      shopId: appointment.shopId,
      to: appointment.client?.phoneNumber ?? '',
      appointmentId: appointment.id,
      message:
        `Olá, ${firstName(appointment.client?.name)}! Seu horário na ${shopName} foi remarcado.\n\n` +
        `Antes: ${formatWhen(previousStart, timezone)}\n` +
        `Agora: ${when}\n` +
        `👤 ${appointment.barber?.name ?? 'Equipe'}\n\n` +
        `Até lá!`,
    });
    await this.scheduleReminder(appointment);
  }

  async appointmentCancelled(appointment: AppointmentLike) {
    const { when, shopName } = await this.context(appointment);

    await this.cancelReminder(appointment.id);
    await this.enqueue({
      kind: 'cancellation',
      shopId: appointment.shopId,
      to: appointment.client?.phoneNumber ?? '',
      appointmentId: appointment.id,
      message:
        `Olá, ${firstName(appointment.client?.name)}. Seu horário de ${when} na ${shopName} foi cancelado.\n\n` +
        `Quando quiser, é só agendar de novo.`,
    });
  }

  async waitlistSlotOpened(
    shopId: string,
    entries: Array<{
      client: { name: string; phoneNumber: string | null };
      service: { name: string };
    }>,
    startTime: Date,
  ) {
    const settings = await this.shop.get(shopId);
    const when = formatWhen(startTime, settings.timezone);

    for (const entry of entries) {
      await this.enqueue({
        kind: 'waitlist',
        shopId,
        to: entry.client.phoneNumber ?? '',
        message:
          `Oi, ${firstName(entry.client.name)}! Vagou um horário na ${settings.name}.\n\n` +
          `✂️ ${entry.service.name}\n` +
          `🗓️ ${when}\n\n` +
          `Corre que é por ordem de chegada.`,
      });
    }
  }

  async birthdayGreeting(
    shopId: string,
    client: { name: string; phoneNumber: string | null },
  ) {
    const settings = await this.shop.get(shopId);
    await this.enqueue({
      kind: 'birthday',
      shopId,
      to: client.phoneNumber ?? '',
      message:
        `Parabéns, ${firstName(client.name)}! 🎉\n\n` +
        `A equipe da ${settings.name} deseja um ótimo aniversário. ` +
        `Passa aqui essa semana para comemorar com o visual em dia.`,
    });
  }

  /**
   * Mensagem da plataforma para o dono da barbearia (mensalidade). Sai pelo
   * número padrão da plataforma, não pelo da barbearia.
   */
  async platformNotice(to: string, message: string) {
    await this.enqueue({ kind: 'platform', to, message });
  }

  // ---------------------------------------------------------------- internos

  /**
   * O lembrete tem id determinístico para poder ser retirado da fila quando o
   * agendamento é cancelado ou remarcado — caso contrário o cliente receberia
   * um lembrete de um horário que não existe mais.
   */
  private async scheduleReminder(appointment: AppointmentLike) {
    const { when, shopName } = await this.context(appointment);
    const remindAt = subHours(appointment.startTime, this.reminderHoursBefore);
    const delay = differenceInMilliseconds(remindAt, new Date());

    if (delay <= 0) return;

    await this.enqueue(
      {
        kind: 'reminder',
        shopId: appointment.shopId,
        to: appointment.client?.phoneNumber ?? '',
        appointmentId: appointment.id,
        message:
          `Lembrete: seu horário na ${shopName} é ${when}.\n\n` +
          `✂️ ${appointment.service?.name ?? 'Serviço'}\n` +
          `👤 ${appointment.barber?.name ?? 'Equipe'}\n\n` +
          `Se não puder vir, avise a gente para liberar o horário.`,
      },
      { delay, jobId: reminderJobId(appointment.id) },
    );
  }

  private async cancelReminder(appointmentId: string) {
    try {
      const job = await this.queue.getJob(reminderJobId(appointmentId));
      await job?.remove();
    } catch (error) {
      // Um lembrete órfão é bem menos grave do que derrubar o cancelamento.
      this.logger.warn(
        `Não foi possível remover o lembrete de ${appointmentId}: ${String(error)}`,
      );
    }
  }

  private async enqueue(
    job: WhatsappJob,
    options: { delay?: number; jobId?: string } = {},
  ) {
    if (!job.to) {
      this.logger.warn(
        `Notificação "${job.kind}" ignorada: cliente sem telefone cadastrado.`,
      );
      return;
    }

    try {
      await this.queue.add(job.kind, job, { ...JOB_OPTIONS, ...options });
    } catch (error) {
      // A fila fora do ar não pode impedir o agendamento de ser criado.
      this.logger.error(
        `Falha ao enfileirar notificação "${job.kind}": ${String(error)}`,
      );
    }
  }

  private async context(appointment: AppointmentLike) {
    const settings = await this.shop.get(appointment.shopId);
    return {
      timezone: settings.timezone,
      shopName: settings.name,
      when: formatWhen(appointment.startTime, settings.timezone),
    };
  }
}

function reminderJobId(appointmentId: string): string {
  // Sem dois-pontos: o BullMQ recusa esse caractere em id customizado, e a
  // falha derrubava silenciosamente o lembrete de 2 horas.
  return `reminder-${appointmentId}`;
}

function firstName(name?: string | null): string {
  return (name ?? 'tudo bem').trim().split(/\s+/)[0];
}

function formatWhen(date: Date, timezone: string): string {
  const [year, month, day] = shopDateOnly(date, timezone).split('-');
  return `${day}/${month}/${year} às ${shopHourLabel(date, timezone)}`;
}
