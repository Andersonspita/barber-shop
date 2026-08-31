import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  AppointmentStatus,
  Prisma,
  Role,
  ShopSettings,
  User,
} from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { addMinutes, differenceInMinutes } from 'date-fns';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { AvailabilityService } from '../availability/availability.service';
import { ShopSettingsService } from '../shop/shop-settings.service';
import {
  dateOnlyToUtcMidnight,
  parseDateOnly,
  shopDateOnly,
  shopRange,
  shopToday,
} from '../common/time.util';

const APPOINTMENT_INCLUDE = {
  service: { select: { id: true, name: true, durationMinutes: true } },
  client: { select: { id: true, name: true, email: true, phoneNumber: true } },
  barber: { select: { id: true, name: true, photoUrl: true } },
  review: { select: { rating: true, comment: true } },
} satisfies Prisma.AppointmentInclude;

export interface SessionUser {
  id: string;
  email: string;
  name: string;
  role: Role;
  isAdmin: boolean;
}

@Injectable()
export class AppointmentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
    private readonly availability: AvailabilityService,
    private readonly shop: ShopSettingsService,
  ) {}

  // ------------------------------------------------------------------ reserva

  /**
   * Reserva com escolha de barbeiro ou "qualquer um".
   *
   * A lista de candidatos sai do próprio motor de disponibilidade, então todas
   * as regras — fuso, jornada, feriado, antecedência, serviço que o barbeiro
   * executa — valem também para quem chama a API direto. A transação
   * serializável continua garantindo que dois clientes não peguem o mesmo
   * horário no mesmo milissegundo.
   */
  async book(params: {
    clientId: string;
    serviceId: string;
    startTime: Date;
    preferredBarberId?: string;
    createdById?: string;
    notes?: string;
    skipAdvanceRules?: boolean;
  }) {
    const {
      clientId,
      serviceId,
      startTime,
      preferredBarberId,
      createdById,
      notes,
      skipAdvanceRules = false,
    } = params;

    const candidates = await this.resolveCandidates(
      serviceId,
      startTime,
      preferredBarberId,
      skipAdvanceRules,
    );

    const appointment = await this.prisma.$transaction(
      async (tx) => {
        for (const candidate of candidates) {
          const conflict = await tx.appointment.findFirst({
            where: {
              barberId: candidate.barberId,
              status: 'SCHEDULED',
              startTime: { lt: candidate.endTime },
              endTime: { gt: startTime },
            },
            select: { id: true },
          });
          if (conflict) continue;

          return tx.appointment.create({
            data: {
              clientId,
              barberId: candidate.barberId,
              serviceId,
              startTime,
              endTime: candidate.endTime,
              priceCharged: candidate.price,
              status: 'SCHEDULED',
              notes: notes ?? null,
              createdById: createdById ?? clientId,
            },
            include: APPOINTMENT_INCLUDE,
          });
        }

        throw new ConflictException(
          'Este horário acabou de ser preenchido. Escolha outro.',
        );
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );

    await this.notifications.appointmentConfirmed(appointment);
    return appointment;
  }

  /**
   * Encaixe de balcão: o barbeiro registra o atendimento de quem chegou sem
   * marcar. Cria o cliente na hora quando ele ainda não tem cadastro — sem
   * isso, metade do movimento de uma barbearia fica fora do sistema, e o
   * relatório financeiro deixa de refletir o caixa.
   */
  async createWalkIn(
    actor: SessionUser,
    input: {
      serviceId: string;
      startTime: Date;
      barberId?: string;
      clientId?: string;
      clientName?: string;
      clientPhone?: string;
      notes?: string;
      force?: boolean;
    },
  ) {
    const barberId = input.barberId ?? actor.id;

    if (barberId !== actor.id && !actor.isAdmin) {
      throw new ForbiddenException(
        'Apenas administradores registram atendimentos para outro profissional.',
      );
    }

    const clientId = input.clientId
      ? await this.assertClientExists(input.clientId)
      : await this.createWalkInClient(input.clientName, input.clientPhone);

    return this.book({
      clientId,
      serviceId: input.serviceId,
      startTime: input.startTime,
      preferredBarberId: barberId,
      createdById: actor.id,
      notes: input.notes,
      skipAdvanceRules: input.force ?? false,
    });
  }

  /**
   * Remarcação. O horário novo é reservado antes de o antigo ser liberado, na
   * mesma transação: cancelar primeiro devolveria a vaga ao mercado e o cliente
   * poderia terminar sem nenhum dos dois.
   */
  async reschedule(
    appointmentId: string,
    newStartTime: Date,
    actor: SessionUser,
    preferredBarberId?: string,
  ) {
    const appointment = await this.prisma.appointment.findUnique({
      where: { id: appointmentId },
      include: APPOINTMENT_INCLUDE,
    });
    if (!appointment) throw new NotFoundException('Agendamento não encontrado.');

    this.assertCanAct(appointment, actor);

    if (appointment.status !== 'SCHEDULED') {
      throw new BadRequestException(
        'Só é possível remarcar um agendamento que ainda está confirmado.',
      );
    }

    const isStaff = actor.role === 'BARBER' || actor.isAdmin;
    if (!isStaff) {
      const settings = await this.shop.get();
      this.assertWithinCancellationWindow(appointment.startTime, settings);
    }

    const candidates = await this.resolveCandidates(
      appointment.serviceId,
      newStartTime,
      preferredBarberId ?? appointment.barberId,
      isStaff,
    );

    const updated = await this.prisma.$transaction(
      async (tx) => {
        for (const candidate of candidates) {
          const conflict = await tx.appointment.findFirst({
            where: {
              id: { not: appointmentId },
              barberId: candidate.barberId,
              status: 'SCHEDULED',
              startTime: { lt: candidate.endTime },
              endTime: { gt: newStartTime },
            },
            select: { id: true },
          });
          if (conflict) continue;

          return tx.appointment.update({
            where: { id: appointmentId },
            data: {
              barberId: candidate.barberId,
              startTime: newStartTime,
              endTime: candidate.endTime,
              priceCharged: candidate.price,
            },
            include: APPOINTMENT_INCLUDE,
          });
        }

        throw new ConflictException(
          'O novo horário não está mais livre. Seu agendamento original foi mantido.',
        );
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );

    await this.notifications.appointmentRescheduled(
      updated,
      appointment.startTime,
    );
    return updated;
  }

  // ------------------------------------------------------------------- status

  async updateStatus(
    appointmentId: string,
    status: AppointmentStatus,
    actor: SessionUser,
    now = new Date(),
  ) {
    const appointment = await this.prisma.appointment.findUnique({
      where: { id: appointmentId },
      include: APPOINTMENT_INCLUDE,
    });
    if (!appointment) throw new NotFoundException('Agendamento não encontrado.');

    this.assertCanAct(appointment, actor);

    const isStaff = actor.role === 'BARBER' || actor.isAdmin;
    const settings = await this.shop.get();

    if (!isStaff && status !== 'CANCELLED') {
      throw new ForbiddenException('Clientes só podem cancelar agendamentos.');
    }

    if (appointment.status !== 'SCHEDULED') {
      throw new BadRequestException(
        `Este agendamento já está como ${this.statusLabel(appointment.status)}.`,
      );
    }

    if (status === 'COMPLETED' && now < appointment.startTime) {
      throw new BadRequestException(
        'Não é possível concluir um agendamento antes do seu horário de início.',
      );
    }

    if (status === 'NO_SHOW') {
      if (!isStaff) {
        throw new ForbiddenException(
          'Apenas a barbearia registra falta de comparecimento.',
        );
      }
      if (now < appointment.startTime) {
        throw new BadRequestException(
          'O horário ainda não começou — aguarde antes de marcar como falta.',
        );
      }
    }

    if (status === 'CANCELLED' && !isStaff) {
      this.assertWithinCancellationWindow(appointment.startTime, settings, now);
    }

    const updated = await this.prisma.appointment.update({
      where: { id: appointmentId },
      data: {
        status,
        cancelledAt: status === 'CANCELLED' ? now : null,
      },
      include: APPOINTMENT_INCLUDE,
    });

    if (status === 'CANCELLED') {
      await this.notifications.appointmentCancelled(updated);
      await this.notifyWaitlist(updated.serviceId, updated.startTime);
    }

    return updated;
  }

  // ------------------------------------------------------------------ leitura

  /**
   * Agenda de quem está logado, sempre recortada por período. Antes esta rota
   * devolvia o histórico inteiro em ordem crescente, o que empurrava os
   * atendimentos de hoje para o fim da lista conforme a base crescia.
   */
  async listForUser(
    user: SessionUser,
    query: {
      from?: string;
      to?: string;
      status?: AppointmentStatus;
      page?: number;
      pageSize?: number;
    },
  ) {
    const settings = await this.shop.get();
    const today = shopToday(settings.timezone);

    const from = parseDateOnly(query.from ?? today, 'from');
    const to = parseDateOnly(query.to ?? from, 'to');
    const { start, end } = shopRange(from, to, settings.timezone);

    const page = Math.max(1, query.page ?? 1);
    const pageSize = Math.min(100, Math.max(1, query.pageSize ?? 50));

    const where: Prisma.AppointmentWhereInput = {
      ...(user.role === 'BARBER'
        ? { barberId: user.id }
        : { clientId: user.id }),
      ...(query.status ? { status: query.status } : {}),
      startTime: { gte: start, lt: end },
    };

    const [items, total] = await Promise.all([
      this.prisma.appointment.findMany({
        where,
        include: APPOINTMENT_INCLUDE,
        orderBy: { startTime: 'asc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.appointment.count({ where }),
    ]);

    return { items, total, page, pageSize, from, to };
  }

  /** Agenda da barbearia inteira, em colunas por barbeiro. Só para admin. */
  async shopAgenda(dateString?: string, barberId?: string) {
    const settings = await this.shop.get();
    const date = parseDateOnly(
      dateString ?? shopToday(settings.timezone),
      'date',
    );
    const { start, end } = shopRange(date, date, settings.timezone);

    const [barbers, appointments, blocks] = await Promise.all([
      this.prisma.user.findMany({
        where: {
          role: 'BARBER',
          isActive: true,
          ...(barberId ? { id: barberId } : {}),
        },
        select: { id: true, name: true, photoUrl: true },
        orderBy: { name: 'asc' },
      }),
      this.prisma.appointment.findMany({
        where: {
          startTime: { lt: end },
          endTime: { gt: start },
          ...(barberId ? { barberId } : {}),
        },
        include: APPOINTMENT_INCLUDE,
        orderBy: { startTime: 'asc' },
      }),
      this.prisma.scheduleBlock.findMany({
        where: {
          startTime: { lt: end },
          endTime: { gt: start },
          ...(barberId ? { barberId } : {}),
        },
        orderBy: { startTime: 'asc' },
      }),
    ]);

    return {
      date,
      timezone: settings.timezone,
      columns: barbers.map((barber) => ({
        barber,
        appointments: appointments.filter((a) => a.barberId === barber.id),
        blocks: blocks.filter((b) => b.barberId === barber.id),
      })),
    };
  }

  // ------------------------------------------------------------------ métricas

  async getTodayMetrics(barberId: string) {
    const settings = await this.shop.get();
    const today = shopToday(settings.timezone);
    const { start, end } = shopRange(today, today, settings.timezone);

    const appointments = await this.prisma.appointment.findMany({
      where: { barberId, startTime: { gte: start, lt: end } },
      select: { status: true, priceCharged: true },
    });

    let totalRevenue = 0;
    let completedCount = 0;
    let pendingCount = 0;
    let noShowCount = 0;

    for (const appt of appointments) {
      if (appt.status === 'COMPLETED') {
        completedCount++;
        totalRevenue += Number(appt.priceCharged);
      } else if (appt.status === 'SCHEDULED') {
        pendingCount++;
      } else if (appt.status === 'NO_SHOW') {
        noShowCount++;
      }
    }

    return { totalRevenue, completedCount, pendingCount, noShowCount };
  }

  async getAdvancedMetrics(
    startDateStr: string,
    endDateStr: string,
    barberId?: string,
  ) {
    const settings = await this.shop.get();
    const startDate = parseDateOnly(startDateStr, 'startDate');
    const endDate = parseDateOnly(endDateStr, 'endDate');

    if (endDate < startDate) {
      throw new BadRequestException(
        'A data final precisa ser igual ou posterior à inicial.',
      );
    }

    const { start, end } = shopRange(startDate, endDate, settings.timezone);

    const appointments = await this.prisma.appointment.findMany({
      where: {
        startTime: { gte: start, lt: end },
        ...(barberId ? { barberId } : {}),
      },
      include: {
        service: { select: { name: true } },
        barber: { select: { name: true, commissionRate: true } },
        client: { select: { name: true, email: true } },
      },
      orderBy: { startTime: 'desc' },
    });

    let totalRevenue = 0;
    let totalCommission = 0;
    let completedCount = 0;
    let cancelledCount = 0;
    let noShowCount = 0;

    const details: Array<Record<string, unknown>> = [];
    const byDay = new Map<string, { revenue: number; count: number }>();

    for (const appt of appointments) {
      if (appt.status === 'CANCELLED') {
        cancelledCount++;
        continue;
      }
      if (appt.status === 'NO_SHOW') {
        noShowCount++;
        continue;
      }
      if (appt.status !== 'COMPLETED') continue;

      completedCount++;
      const price = Number(appt.priceCharged);
      const rate = appt.barber?.commissionRate
        ? Number(appt.barber.commissionRate)
        : 0.5;
      const commission = price * rate;

      totalRevenue += price;
      totalCommission += commission;

      const day = shopDateOnly(appt.startTime, settings.timezone);
      const bucket = byDay.get(day) ?? { revenue: 0, count: 0 };
      bucket.revenue += price;
      bucket.count += 1;
      byDay.set(day, bucket);

      details.push({
        id: appt.id,
        startTime: appt.startTime,
        clientName: appt.client?.name || appt.client?.email || 'Desconhecido',
        serviceName: appt.service.name,
        price,
        commission,
        barberName: appt.barber?.name || 'Desconhecido',
      });
    }

    return {
      totalRevenue,
      totalCommission,
      completedCount,
      cancelledCount,
      noShowCount,
      ticketAverage: completedCount > 0 ? totalRevenue / completedCount : 0,
      series: [...byDay.entries()]
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([date, v]) => ({ date, revenue: v.revenue, count: v.count })),
      details,
    };
  }

  // ---------------------------------------------------------------- avaliação

  async createReview(
    appointmentId: string,
    actor: SessionUser,
    rating: number,
    comment?: string,
  ) {
    const appointment = await this.prisma.appointment.findUnique({
      where: { id: appointmentId },
      select: { id: true, clientId: true, status: true },
    });
    if (!appointment) throw new NotFoundException('Agendamento não encontrado.');

    if (appointment.clientId !== actor.id) {
      throw new ForbiddenException('Só o cliente atendido pode avaliar.');
    }
    if (appointment.status !== 'COMPLETED') {
      throw new BadRequestException(
        'A avaliação fica disponível depois do atendimento.',
      );
    }

    return this.prisma.review.upsert({
      where: { appointmentId },
      update: { rating, comment: comment ?? null },
      create: { appointmentId, rating, comment: comment ?? null },
    });
  }

  // ---------------------------------------------------------------- internos

  /**
   * Barbeiros que podem atender este horário, com duração e preço já
   * resolvidos. Com barbeiro preferido, o erro de validação é propagado para
   * que o cliente saiba o motivo real da recusa.
   */
  private async resolveCandidates(
    serviceId: string,
    startTime: Date,
    preferredBarberId?: string,
    skipAdvanceRules = false,
  ): Promise<Array<{ barberId: string; endTime: Date; price: Prisma.Decimal }>> {
    if (preferredBarberId) {
      const { endTime } = await this.availability.assertBookable(
        preferredBarberId,
        serviceId,
        startTime,
        { skipAdvanceRules },
      );
      const { price } = await this.availability.effectiveService(
        serviceId,
        preferredBarberId,
      );
      return [{ barberId: preferredBarberId, endTime, price }];
    }

    const settings = await this.shop.get();
    const dateOnly = shopDateOnly(startTime, settings.timezone);
    const slots = await this.availability.getAvailability(dateOnly, serviceId);
    const slot = slots.find((s) => s.dateTime === startTime.toISOString());

    if (!slot || slot.barberIds.length === 0) {
      throw new ConflictException(
        'Não há profissionais disponíveis neste horário.',
      );
    }

    return Promise.all(
      slot.barberIds.map(async (barberId) => {
        const { durationMinutes, price } =
          await this.availability.effectiveService(serviceId, barberId);
        return {
          barberId,
          endTime: addMinutes(startTime, durationMinutes),
          price,
        };
      }),
    );
  }

  private assertCanAct(
    appointment: { barberId: string; clientId: string },
    actor: SessionUser,
  ) {
    if (actor.isAdmin) return;
    if (actor.role === 'BARBER' && appointment.barberId === actor.id) return;
    if (actor.role === 'CLIENT' && appointment.clientId === actor.id) return;
    throw new ForbiddenException('Sem permissão para alterar este agendamento.');
  }

  private assertWithinCancellationWindow(
    startTime: Date,
    settings: ShopSettings,
    now = new Date(),
  ) {
    const window = settings.cancellationWindowMinutes;
    if (window <= 0) return;

    const minutesLeft = differenceInMinutes(startTime, now);
    if (minutesLeft < window) {
      throw new BadRequestException(
        `Cancelamentos pelo app precisam ser feitos com ${this.humanizeMinutes(window)} de antecedência. Entre em contato com a barbearia.`,
      );
    }
  }

  private humanizeMinutes(minutes: number): string {
    if (minutes < 60) return `${minutes} minutos`;
    const hours = minutes / 60;
    return Number.isInteger(hours)
      ? `${hours} hora${hours > 1 ? 's' : ''}`
      : `${hours.toFixed(1)} horas`;
  }

  private statusLabel(status: AppointmentStatus): string {
    return {
      SCHEDULED: 'confirmado',
      COMPLETED: 'concluído',
      CANCELLED: 'cancelado',
      NO_SHOW: 'falta',
    }[status];
  }

  private async assertClientExists(clientId: string): Promise<string> {
    const client = await this.prisma.user.findUnique({
      where: { id: clientId },
      select: { id: true },
    });
    if (!client) throw new NotFoundException('Cliente não encontrado.');
    return client.id;
  }

  /**
   * Cliente de balcão: cadastro mínimo com senha aleatória e troca obrigatória.
   * O e-mail é sintético porque a coluna é única e quem chega sem marcar
   * costuma não ter um para dar.
   */
  private async createWalkInClient(
    name?: string,
    phone?: string,
  ): Promise<string> {
    if (!name?.trim()) {
      throw new BadRequestException(
        'Informe o cliente existente ou o nome de quem será atendido.',
      );
    }

    if (phone?.trim()) {
      const existing = await this.prisma.user.findFirst({
        where: { phoneNumber: phone.trim(), role: 'CLIENT' },
        select: { id: true },
      });
      if (existing) return existing.id;
    }

    const suffix = Date.now().toString(36);
    const created = await this.prisma.user.create({
      data: {
        name: name.trim(),
        email: `balcao.${suffix}@local.invalid`,
        phoneNumber: phone?.trim() || null,
        passwordHash: await bcrypt.hash(randomPassword(), 10),
        role: 'CLIENT',
        mustChangePassword: true,
      },
      select: { id: true },
    });
    return created.id;
  }

  /** Cancelou? Quem estava na fila para aquele dia recebe o aviso. */
  private async notifyWaitlist(serviceId: string, startTime: Date) {
    const settings = await this.shop.get();
    const date = dateOnlyToUtcMidnight(
      shopDateOnly(startTime, settings.timezone),
    );

    const entries = await this.prisma.waitlistEntry.findMany({
      where: { serviceId, date, notifiedAt: null },
      include: {
        client: { select: { name: true, phoneNumber: true } },
        service: { select: { name: true } },
      },
      take: 20,
    });
    if (entries.length === 0) return;

    await this.notifications.waitlistSlotOpened(entries, startTime);
    await this.prisma.waitlistEntry.updateMany({
      where: { id: { in: entries.map((e) => e.id) } },
      data: { notifiedAt: new Date() },
    });
  }
}

function randomPassword(): string {
  return Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2);
}

export type AppointmentWithRelations = Prisma.AppointmentGetPayload<{
  include: typeof APPOINTMENT_INCLUDE;
}>;

export type { User };
