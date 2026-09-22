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

  /**
   * Barbeiro da barbearia de quem está pedindo. É a única porta de entrada
   * dos bloqueios, que não têm `shopId` próprio: pertencem à barbearia do
   * barbeiro.
   */
  async assertBarberInShop(shopId: string, barberId: string) {
    const barber = await this.prisma.user.findFirst({
      where: { id: barberId, shopId, role: 'BARBER' },
      select: { id: true },
    });
    if (!barber) throw new NotFoundException('Profissional não encontrado.');
  }

  async createBlock(
    shopId: string,
    barberId: string,
    startTime: Date,
    endTime: Date,
    reason?: string,
  ) {
    await this.assertBarberInShop(shopId, barberId);

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

  async getBlocks(shopId: string, barberId: string, start?: Date, end?: Date) {
    await this.assertBarberInShop(shopId, barberId);

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

  async deleteBlock(
    shopId: string,
    id: string,
    barberId: string,
    isAdmin: boolean,
  ) {
    const block = await this.prisma.scheduleBlock.findFirst({
      where: { id, barber: { shopId } },
    });
    if (!block) throw new NotFoundException('Bloqueio não encontrado.');

    if (!isAdmin && block.barberId !== barberId) {
      throw new ForbiddenException('Sem permissão para remover este bloqueio.');
    }

    return this.prisma.scheduleBlock.delete({ where: { id } });
  }
}
