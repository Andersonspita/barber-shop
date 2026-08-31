import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, Service, ShopSettings } from '@prisma/client';
import { addMinutes } from 'date-fns';
import { PrismaService } from '../prisma/prisma.service';
import { ShopSettingsService } from '../shop/shop-settings.service';
import {
  dateOnlyToUtcMidnight,
  daysBetween,
  parseDateOnly,
  shopDateOnly,
  shopHourLabel,
  shopTimeToUtc,
  shopToday,
  shopWeekday,
} from '../common/time.util';

export interface AvailableSlot {
  time: string;
  available: boolean;
  dateTime: string;
  /** Quem pode atender neste horário — permite ao cliente ver o profissional. */
  barberIds: string[];
}

interface Interval {
  start: Date;
  end: Date;
}

/** Duração e preço efetivos de um serviço para um barbeiro específico. */
export interface EffectiveService {
  durationMinutes: number;
  price: Prisma.Decimal;
}

/**
 * Motor de disponibilidade.
 *
 * Regras que ele aplica, todas configuráveis: fuso da barbearia, jornada por
 * barbeiro e dia da semana, feriados, bloqueios manuais, antecedência mínima,
 * horizonte máximo de agendamento e quais serviços cada barbeiro executa.
 */
@Injectable()
export class AvailabilityService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly shop: ShopSettingsService,
  ) {}

  async getAvailability(
    dateString: string,
    serviceId: string,
    preferredBarberId?: string,
    now = new Date(),
  ): Promise<AvailableSlot[]> {
    const settings = await this.shop.get();
    const dateOnly = this.assertDateWithinHorizon(dateString, settings, now);

    if (await this.isHoliday(dateOnly)) return [];

    const service = await this.findActiveService(serviceId);
    const barbers = await this.eligibleBarbers(serviceId, preferredBarberId);
    if (barbers.length === 0) return [];

    const barberIds = barbers.map((b) => b.id);
    const weekday = shopWeekday(
      shopTimeToUtc(dateOnly, 12 * 60, settings.timezone),
      settings.timezone,
    );

    const shifts = await this.prisma.workingHours.findMany({
      where: { barberId: { in: barberIds }, weekday },
    });
    if (shifts.length === 0) return [];

    const dayStart = shopTimeToUtc(dateOnly, 0, settings.timezone);
    const dayEnd = shopTimeToUtc(dateOnly, 24 * 60, settings.timezone);
    const busy = await this.loadBusyIntervals(barberIds, dayStart, dayEnd);

    const earliestBookable = addMinutes(now, settings.minAdvanceMinutes);

    // Cada barbeiro tem sua própria janela e possivelmente sua própria duração
    // para o mesmo serviço, então os slots são gerados por barbeiro e depois
    // consolidados por horário.
    const slotsByTime = new Map<number, Set<string>>();

    for (const barber of barbers) {
      const duration = this.effectiveDuration(service, barber.overrides);
      const barberShifts = shifts.filter((s) => s.barberId === barber.id);

      for (const shift of barberShifts) {
        const shiftStart = shopTimeToUtc(
          dateOnly,
          shift.startMinute,
          settings.timezone,
        );
        const shiftEnd = shopTimeToUtc(
          dateOnly,
          shift.endMinute,
          settings.timezone,
        );

        for (
          let slot = shiftStart;
          slot < shiftEnd;
          slot = addMinutes(slot, settings.slotIntervalMinutes)
        ) {
          const slotEnd = addMinutes(slot, duration);

          if (slotEnd > shiftEnd) break;
          if (slot < earliestBookable) continue;
          if (this.overlapsAny(busy.get(barber.id), slot, slotEnd)) continue;

          const key = slot.getTime();
          const set = slotsByTime.get(key) ?? new Set<string>();
          set.add(barber.id);
          slotsByTime.set(key, set);
        }
      }
    }

    return [...slotsByTime.entries()]
      .sort(([a], [b]) => a - b)
      .map(([millis, ids]) => {
        const at = new Date(millis);
        return {
          time: shopHourLabel(at, settings.timezone),
          available: true,
          dateTime: at.toISOString(),
          barberIds: [...ids],
        };
      });
  }

  /**
   * Revalida no servidor tudo que a tela de agendamento já filtrou. A validação
   * da interface nunca é a validação de verdade: sem isto, um POST direto marca
   * no passado, no feriado ou fora do expediente.
   */
  async assertBookable(
    barberId: string,
    serviceId: string,
    startTime: Date,
    options: { ignoreAppointmentId?: string; skipAdvanceRules?: boolean } = {},
    now = new Date(),
  ): Promise<{ endTime: Date; settings: ShopSettings }> {
    const settings = await this.shop.get();
    const dateOnly = shopDateOnly(startTime, settings.timezone);

    if (!options.skipAdvanceRules) {
      this.assertDateWithinHorizon(dateOnly, settings, now);

      const earliest = addMinutes(now, settings.minAdvanceMinutes);
      if (startTime < earliest) {
        throw new BadRequestException(
          settings.minAdvanceMinutes > 0
            ? `Agendamentos precisam de ao menos ${settings.minAdvanceMinutes} minutos de antecedência.`
            : 'Não é possível agendar em um horário que já passou.',
        );
      }
    }

    if (await this.isHoliday(dateOnly)) {
      throw new BadRequestException('A barbearia está fechada nesta data.');
    }

    const service = await this.findActiveService(serviceId);
    const [barber] = await this.eligibleBarbers(serviceId, barberId);
    if (!barber) {
      throw new BadRequestException(
        'Este profissional não atende o serviço escolhido.',
      );
    }

    const duration = this.effectiveDuration(service, barber.overrides);
    const endTime = addMinutes(startTime, duration);
    const weekday = shopWeekday(startTime, settings.timezone);

    const shifts = await this.prisma.workingHours.findMany({
      where: { barberId, weekday },
    });

    const withinShift = shifts.some((shift) => {
      const shiftStart = shopTimeToUtc(
        dateOnly,
        shift.startMinute,
        settings.timezone,
      );
      const shiftEnd = shopTimeToUtc(
        dateOnly,
        shift.endMinute,
        settings.timezone,
      );
      return startTime >= shiftStart && endTime <= shiftEnd;
    });

    if (!withinShift) {
      throw new BadRequestException(
        'O horário escolhido está fora da jornada deste profissional.',
      );
    }

    return { endTime, settings };
  }

  /** Preço e duração de um serviço para um barbeiro, aplicando sobrescritas. */
  async effectiveService(
    serviceId: string,
    barberId: string,
  ): Promise<EffectiveService> {
    const service = await this.findActiveService(serviceId);
    const override = await this.prisma.barberService.findUnique({
      where: { barberId_serviceId: { barberId, serviceId } },
    });

    return {
      durationMinutes: override?.durationMinutesOverride ?? service.durationMinutes,
      price: override?.priceOverride ?? service.price,
    };
  }

  // ---------------------------------------------------------------- internos

  private assertDateWithinHorizon(
    dateString: string,
    settings: ShopSettings,
    now: Date,
  ): string {
    const dateOnly = parseDateOnly(dateString);
    const today = shopToday(settings.timezone, now);
    const offset = daysBetween(today, dateOnly);

    if (offset < 0) {
      throw new BadRequestException('Esta data já passou.');
    }
    if (offset > settings.maxAdvanceDays) {
      throw new BadRequestException(
        `A agenda está aberta para os próximos ${settings.maxAdvanceDays} dias.`,
      );
    }
    return dateOnly;
  }

  private async isHoliday(dateOnly: string): Promise<boolean> {
    const holiday = await this.prisma.holiday.findUnique({
      where: { date: dateOnlyToUtcMidnight(dateOnly) },
    });
    return holiday !== null;
  }

  private async findActiveService(serviceId: string): Promise<Service> {
    const service = await this.prisma.service.findUnique({
      where: { id: serviceId },
    });
    if (!service || !service.isActive) {
      throw new NotFoundException('Serviço não encontrado.');
    }
    return service;
  }

  /**
   * Barbeiros ativos que executam o serviço. Um barbeiro sem nenhum vínculo
   * cadastrado é considerado apto a tudo — assim bases criadas antes do
   * vínculo N-N continuam funcionando sem migração de dados.
   */
  private async eligibleBarbers(serviceId: string, preferredBarberId?: string) {
    const barbers = await this.prisma.user.findMany({
      where: {
        role: 'BARBER',
        isActive: true,
        ...(preferredBarberId ? { id: preferredBarberId } : {}),
      },
      select: { id: true, name: true },
      orderBy: { name: 'asc' },
    });
    if (barbers.length === 0) return [];

    const links = await this.prisma.barberService.findMany({
      where: { barberId: { in: barbers.map((b) => b.id) } },
    });

    const hasAnyLink = new Set(links.map((l) => l.barberId));

    return barbers
      .filter(
        (b) =>
          !hasAnyLink.has(b.id) ||
          links.some((l) => l.barberId === b.id && l.serviceId === serviceId),
      )
      .map((b) => ({
        ...b,
        overrides: links.find(
          (l) => l.barberId === b.id && l.serviceId === serviceId,
        ),
      }));
  }

  private effectiveDuration(
    service: Service,
    override?: { durationMinutesOverride: number | null } | null,
  ): number {
    return override?.durationMinutesOverride ?? service.durationMinutes;
  }

  /** Agendamentos e bloqueios do dia, agrupados por barbeiro. */
  private async loadBusyIntervals(
    barberIds: string[],
    dayStart: Date,
    dayEnd: Date,
  ): Promise<Map<string, Interval[]>> {
    // O filtro é por sobreposição, não por início dentro do dia: um
    // atendimento que começa às 17h45 e termina às 18h30 precisa bloquear o
    // primeiro slot do intervalo seguinte.
    const [appointments, blocks] = await Promise.all([
      this.prisma.appointment.findMany({
        where: {
          barberId: { in: barberIds },
          status: 'SCHEDULED',
          startTime: { lt: dayEnd },
          endTime: { gt: dayStart },
        },
        select: { barberId: true, startTime: true, endTime: true },
      }),
      this.prisma.scheduleBlock.findMany({
        where: {
          barberId: { in: barberIds },
          startTime: { lt: dayEnd },
          endTime: { gt: dayStart },
        },
        select: { barberId: true, startTime: true, endTime: true },
      }),
    ]);

    const map = new Map<string, Interval[]>();
    for (const row of [...appointments, ...blocks]) {
      const list = map.get(row.barberId) ?? [];
      list.push({ start: row.startTime, end: row.endTime });
      map.set(row.barberId, list);
    }
    return map;
  }

  private overlapsAny(
    intervals: Interval[] | undefined,
    start: Date,
    end: Date,
  ): boolean {
    if (!intervals) return false;
    return intervals.some((i) => i.start < end && i.end > start);
  }
}
