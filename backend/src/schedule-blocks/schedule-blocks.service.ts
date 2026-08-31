import {
  Injectable,
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class ScheduleBlocksService {
  constructor(private prisma: PrismaService) {}

  async createBlock(barberId: string, startTime: Date, endTime: Date, reason?: string) {
    if (startTime >= endTime) {
      throw new BadRequestException('O horário de fim deve ser após o horário de início.');
    }

    // Verifica se já existe um agendamento nesse horário para esse barbeiro
    const conflictAppt = await this.prisma.appointment.findFirst({
      where: {
        barberId,
        status: 'SCHEDULED',
        AND: [
          { startTime: { lt: endTime } },
          { endTime: { gt: startTime } }
        ]
      }
    });

    if (conflictAppt) {
      throw new ConflictException('Já existe um agendamento marcado neste horário.');
    }

    // Verifica conflito com outro bloqueio
    const conflictBlock = await this.prisma.scheduleBlock.findFirst({
      where: {
        barberId,
        AND: [
          { startTime: { lt: endTime } },
          { endTime: { gt: startTime } }
        ]
      }
    });

    if (conflictBlock) {
      throw new ConflictException('Já existe um bloqueio de agenda neste horário.');
    }

    return this.prisma.scheduleBlock.create({
      data: {
        barberId,
        startTime,
        endTime,
        reason
      }
    });
  }

  async getBlocks(barberId: string, start?: Date, end?: Date) {
    // Filtro por sobreposição: um bloqueio que começa antes da janela e
    // termina dentro dela precisa aparecer.
    const where: Prisma.ScheduleBlockWhereInput = {
      barberId,
      ...(start && end
        ? { startTime: { lt: end }, endTime: { gt: start } }
        : {}),
    };

    return this.prisma.scheduleBlock.findMany({
      where,
      orderBy: { startTime: 'asc' }
    });
  }

  async deleteBlock(id: string, barberId: string, isAdmin: boolean) {
    const block = await this.prisma.scheduleBlock.findUnique({ where: { id } });
    if (!block) throw new NotFoundException('Bloqueio não encontrado.');

    if (!isAdmin && block.barberId !== barberId) {
      throw new ForbiddenException('Sem permissão para remover este bloqueio.');
    }

    return this.prisma.scheduleBlock.delete({ where: { id } });
  }
}
