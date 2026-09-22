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
  Query,
} from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AdminOnly } from '../common/roles.guard';
import { ShopId } from '../common/shop-context';
import { generateTemporaryPassword } from '../common/password.util';
import { CreateClientDto, ListClientsQueryDto, UpdateClientDto } from './dto';

const CLIENT_FIELDS = {
  id: true,
  name: true,
  email: true,
  phoneNumber: true,
  birthDate: true,
  isActive: true,
  createdAt: true,
} as const;

@AdminOnly()
@Controller('admin/clients')
export class AdminClientsController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  async list(@ShopId() shopId: string, @Query() query: ListClientsQueryDto) {
    const page = Math.max(1, query.page ?? 1);
    const pageSize = Math.min(100, Math.max(1, query.pageSize ?? 50));
    const search = query.search?.trim();

    const where: Prisma.UserWhereInput = {
      shopId,
      role: 'CLIENT',
      ...(search
        ? {
            OR: [
              { name: { contains: search, mode: 'insensitive' } },
              { email: { contains: search, mode: 'insensitive' } },
              { phoneNumber: { contains: search } },
            ],
          }
        : {}),
    };

    const [items, total] = await Promise.all([
      this.prisma.user.findMany({
        where,
        orderBy: { name: 'asc' },
        select: CLIENT_FIELDS,
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.user.count({ where }),
    ]);

    return { items, total, page, pageSize };
  }

  @Post()
  async create(@ShopId() shopId: string, @Body() body: CreateClientDto) {
    const email =
      body.email?.trim().toLowerCase() ||
      `balcao.${Date.now().toString(36)}@local.invalid`;

    await this.assertEmailAvailable(shopId, email);

    const temporaryPassword = generateTemporaryPassword();
    const client = await this.prisma.user.create({
      data: {
        shopId,
        name: body.name.trim(),
        email,
        phoneNumber: body.phoneNumber?.trim() || null,
        birthDate: parseDate(body.birthDate),
        passwordHash: await bcrypt.hash(temporaryPassword, 10),
        role: 'CLIENT',
        mustChangePassword: true,
      },
      select: CLIENT_FIELDS,
    });

    return { ...client, temporaryPassword };
  }

  @Put(':id')
  async update(
    @ShopId() shopId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: UpdateClientDto,
  ) {
    await this.assertOwned(shopId, id);
    if (body.email) await this.assertEmailAvailable(shopId, body.email, id);

    return this.prisma.user.update({
      where: { id },
      data: {
        name: body.name.trim(),
        ...(body.email ? { email: body.email.trim().toLowerCase() } : {}),
        phoneNumber: body.phoneNumber?.trim() || null,
        birthDate: parseDate(body.birthDate),
        isActive: body.isActive ?? true,
      },
      select: CLIENT_FIELDS,
    });
  }

  /** Desativa em vez de excluir: o histórico sustenta o relatório financeiro. */
  @Delete(':id')
  async deactivate(
    @ShopId() shopId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    await this.assertOwned(shopId, id);
    return this.prisma.user.update({
      where: { id },
      data: { isActive: false },
      select: CLIENT_FIELDS,
    });
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
      select: CLIENT_FIELDS,
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

  @Get(':id/history')
  async history(
    @ShopId() shopId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    const client = await this.prisma.user.findFirst({
      where: { id, shopId, role: 'CLIENT' },
      select: CLIENT_FIELDS,
    });
    if (!client) throw new NotFoundException('Cliente não encontrado.');

    const appointments = await this.prisma.appointment.findMany({
      where: { clientId: id, shopId },
      include: {
        service: { select: { name: true } },
        barber: { select: { name: true } },
        review: { select: { rating: true, comment: true } },
      },
      orderBy: { startTime: 'desc' },
      take: 200,
    });

    let totalSpent = 0;
    let completedCount = 0;
    let cancelledCount = 0;
    let noShowCount = 0;

    const history = appointments.map((appt) => {
      if (appt.status === 'COMPLETED') {
        completedCount++;
        totalSpent += Number(appt.priceCharged);
      } else if (appt.status === 'NO_SHOW') {
        // Falta e cancelamento são coisas diferentes: uma custa a cadeira
        // vazia, a outra devolve o horário para outro cliente.
        noShowCount++;
      } else if (appt.status === 'CANCELLED') {
        cancelledCount++;
      }

      return {
        id: appt.id,
        date: appt.startTime,
        service: appt.service.name,
        price: Number(appt.priceCharged),
        barber: appt.barber?.name ?? 'Desconhecido',
        status: appt.status,
        rating: appt.review?.rating ?? null,
      };
    });

    return {
      client,
      metrics: {
        totalSpent,
        completedCount,
        cancelledCount,
        noShowCount,
        totalAppointments: appointments.length,
        ticketAverage: completedCount > 0 ? totalSpent / completedCount : 0,
      },
      history,
    };
  }

  /** Cliente de outra barbearia responde como inexistente. */
  private async assertOwned(shopId: string, id: string) {
    const found = await this.prisma.user.findFirst({
      where: { id, shopId, role: 'CLIENT' },
      select: { id: true },
    });
    if (!found) throw new NotFoundException('Cliente não encontrado.');
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

function parseDate(value?: string): Date | null {
  if (!value) return null;
  const date = new Date(`${value.slice(0, 10)}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime())) {
    throw new BadRequestException('Data de nascimento inválida.');
  }
  return date;
}
