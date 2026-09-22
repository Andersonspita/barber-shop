import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  NotFoundException,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Put,
} from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../prisma/prisma.service';
import { AdminOnly } from '../common/roles.guard';
import { ShopId } from '../common/shop-context';
import { generateTemporaryPassword } from '../common/password.util';
import {
  CreateBarberDto,
  ReplaceBarberServicesDto,
  ReplaceWorkingHoursDto,
  UpdateBarberDto,
} from './dto';

const BARBER_FIELDS = {
  id: true,
  name: true,
  email: true,
  phoneNumber: true,
  isAdmin: true,
  isActive: true,
  photoUrl: true,
  bio: true,
  commissionRate: true,
  createdAt: true,
} as const;

@AdminOnly()
@Controller('admin/barbers')
export class AdminBarbersController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  async list(@ShopId() shopId: string) {
    return this.prisma.user.findMany({
      where: { shopId, role: 'BARBER' },
      orderBy: [{ isActive: 'desc' }, { name: 'asc' }],
      select: {
        ...BARBER_FIELDS,
        _count: { select: { barberAppointments: true } },
      },
    });
  }

  /**
   * A senha temporária é sorteada e devolvida uma única vez, para o admin
   * repassar. Antes era `Mudar@123` fixa no código, igual para todo mundo e
   * sem troca obrigatória.
   */
  @Post()
  async create(@ShopId() shopId: string, @Body() body: CreateBarberDto) {
    await this.assertEmailAvailable(shopId, body.email);

    const temporaryPassword = generateTemporaryPassword();
    const barber = await this.prisma.user.create({
      data: {
        shopId,
        name: body.name.trim(),
        email: body.email.trim().toLowerCase(),
        phoneNumber: body.phoneNumber?.trim() || null,
        photoUrl: body.photoUrl || null,
        bio: body.bio || null,
        passwordHash: await bcrypt.hash(temporaryPassword, 10),
        role: 'BARBER',
        isAdmin: body.isAdmin ?? false,
        commissionRate: body.commissionRate ?? 0.5,
        mustChangePassword: true,
      },
      select: BARBER_FIELDS,
    });

    // Jornada inicial: segunda a sexta 09h-18h, sábado 09h-14h.
    await this.prisma.workingHours.createMany({
      data: [
        ...[1, 2, 3, 4, 5].map((weekday) => ({
          barberId: barber.id,
          weekday,
          startMinute: 9 * 60,
          endMinute: 18 * 60,
        })),
        { barberId: barber.id, weekday: 6, startMinute: 9 * 60, endMinute: 14 * 60 },
      ],
      skipDuplicates: true,
    });

    return { ...barber, temporaryPassword };
  }

  @Put(':id')
  async update(
    @ShopId() shopId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: UpdateBarberDto,
  ) {
    await this.assertOwned(shopId, id);
    await this.assertEmailAvailable(shopId, body.email, id);

    return this.prisma.user.update({
      where: { id },
      data: {
        name: body.name.trim(),
        email: body.email.trim().toLowerCase(),
        phoneNumber: body.phoneNumber?.trim() || null,
        photoUrl: body.photoUrl || null,
        bio: body.bio || null,
        isAdmin: body.isAdmin ?? false,
        isActive: body.isActive ?? true,
        commissionRate: body.commissionRate ?? 0.5,
      },
      select: BARBER_FIELDS,
    });
  }

  /**
   * Desativação, não exclusão: o histórico de atendimentos precisa continuar
   * de pé para o financeiro fechar. Um barbeiro inativo some da agenda e da
   * landing page.
   */
  @Delete(':id')
  async deactivate(
    @ShopId() shopId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    await this.assertOwned(shopId, id);
    const upcoming = await this.prisma.appointment.count({
      where: { barberId: id, status: 'SCHEDULED', startTime: { gte: new Date() } },
    });

    const barber = await this.prisma.user.update({
      where: { id },
      data: { isActive: false },
      select: BARBER_FIELDS,
    });

    return {
      ...barber,
      warning:
        upcoming > 0
          ? `Este profissional tem ${upcoming} agendamento(s) futuro(s). Remarque-os para outro barbeiro.`
          : null,
    };
  }

  @Patch(':id/reactivate')
  async reactivate(
    @ShopId() shopId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    await this.assertOwned(shopId, id);
    return this.prisma.user.update({
      where: { id },
      data: { isActive: true },
      select: BARBER_FIELDS,
    });
  }

  @Post(':id/reset-password')
  async resetPassword(
    @ShopId() shopId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    await this.assertOwned(shopId, id);
    const temporaryPassword = generateTemporaryPassword();
    await this.prisma.user.update({
      where: { id },
      data: {
        passwordHash: await bcrypt.hash(temporaryPassword, 10),
        mustChangePassword: true,
      },
    });
    return { temporaryPassword };
  }

  // ------------------------------------------------------------- jornada

  @Get(':id/working-hours')
  async getWorkingHours(
    @ShopId() shopId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    await this.assertOwned(shopId, id);
    return this.prisma.workingHours.findMany({
      where: { barberId: id },
      orderBy: [{ weekday: 'asc' }, { startMinute: 'asc' }],
    });
  }

  /** Substitui a jornada inteira: é como a tela edita, semana por semana. */
  @Put(':id/working-hours')
  async replaceWorkingHours(
    @ShopId() shopId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: ReplaceWorkingHoursDto,
  ) {
    await this.assertOwned(shopId, id);

    for (const shift of body.shifts) {
      if (shift.endMinute <= shift.startMinute) {
        throw new BadRequestException(
          'O fim de cada turno precisa ser depois do início.',
        );
      }
    }

    assertNoOverlap(body.shifts);

    await this.prisma.$transaction([
      this.prisma.workingHours.deleteMany({ where: { barberId: id } }),
      this.prisma.workingHours.createMany({
        data: body.shifts.map((s) => ({ ...s, barberId: id })),
      }),
    ]);

    return this.getWorkingHours(shopId, id);
  }

  // ------------------------------------------------------------- serviços

  @Get(':id/services')
  async getServices(
    @ShopId() shopId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    await this.assertOwned(shopId, id);
    return this.prisma.barberService.findMany({
      where: { barberId: id },
      include: { service: { select: { id: true, name: true } } },
    });
  }

  /** Lista vazia devolve o barbeiro ao estado "atende todos os serviços". */
  @Put(':id/services')
  async replaceServices(
    @ShopId() shopId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: ReplaceBarberServicesDto,
  ) {
    await this.assertOwned(shopId, id);

    // Vincular um serviço de outra barbearia faria o barbeiro "atender" algo
    // que não existe na vitrine dele.
    const serviceIds = [...new Set(body.services.map((s) => s.serviceId))];
    const owned = await this.prisma.service.count({
      where: { id: { in: serviceIds }, shopId },
    });
    if (owned !== serviceIds.length) {
      throw new BadRequestException('Serviço não encontrado nesta barbearia.');
    }

    await this.prisma.$transaction([
      this.prisma.barberService.deleteMany({ where: { barberId: id } }),
      this.prisma.barberService.createMany({
        data: body.services.map((s) => ({
          barberId: id,
          serviceId: s.serviceId,
          priceOverride: s.priceOverride ?? null,
          durationMinutesOverride: s.durationMinutesOverride ?? null,
        })),
      }),
    ]);

    return this.getServices(shopId, id);
  }

  /** Barbeiro de outra barbearia responde como inexistente. */
  private async assertOwned(shopId: string, id: string) {
    const found = await this.prisma.user.findFirst({
      where: { id, shopId, role: 'BARBER' },
      select: { id: true },
    });
    if (!found) throw new NotFoundException('Profissional não encontrado.');
  }

  private async assertEmailAvailable(
    shopId: string,
    email: string,
    exceptId?: string,
  ) {
    const existing = await this.prisma.user.findUnique({
      where: { shopId_email: { shopId, email: email.trim().toLowerCase() } },
      select: { id: true },
    });
    if (existing && existing.id !== exceptId) {
      throw new BadRequestException('Este e-mail já está cadastrado.');
    }
  }
}

function assertNoOverlap(
  shifts: Array<{ weekday: number; startMinute: number; endMinute: number }>,
) {
  const byDay = new Map<number, Array<{ start: number; end: number }>>();

  for (const shift of shifts) {
    const list = byDay.get(shift.weekday) ?? [];
    if (
      list.some((s) => s.start < shift.endMinute && s.end > shift.startMinute)
    ) {
      throw new BadRequestException(
        'Há turnos sobrepostos no mesmo dia da semana.',
      );
    }
    list.push({ start: shift.startMinute, end: shift.endMinute });
    byDay.set(shift.weekday, list);
  }
}
