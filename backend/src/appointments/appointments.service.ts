import { Injectable, ConflictException, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Prisma } from '@prisma/client';
import { addMinutes } from 'date-fns';
import { NotificationsService } from '../notifications/notifications.service';

@Injectable()
export class AppointmentsService {
  constructor(
    private prisma: PrismaService,
    private notificationsService: NotificationsService,
  ) {}

  /**
   * RF03 - Agendamento Dinâmico (Escolha de Barbeiro ou Qualquer Um)
   */
  async bookAnyAvailableBarber(clientId: string, serviceId: string, startTime: Date, preferredBarberId?: string) {
    const service = await this.prisma.service.findUnique({ where: { id: serviceId } });
    if (!service) throw new NotFoundException('Serviço não encontrado');

    const endTime = addMinutes(startTime, service.durationMinutes);

    // Transação isolada para garantir que ninguém fure a fila no mesmo milissegundo
    const appointment = await this.prisma.$transaction(async (tx) => {
      
      // Busca o barbeiro escolhido (ou qualquer um) que esteja sem agendamento sobreposto (SCHEDULED)
      const whereClause: any = {
        role: 'BARBER',
        NOT: {
          barberAppointments: {
            some: {
              status: 'SCHEDULED',
              startTime: { lt: endTime },
              endTime: { gt: startTime },
            },
          },
        },
      };

      if (preferredBarberId) {
        whereClause.id = preferredBarberId;
      }

      const availableBarbers = await tx.user.findMany({
        where: whereClause,
        take: 1,
      });

      if (availableBarbers.length === 0) {
        throw new ConflictException('Não há barbeiros disponíveis neste horário.');
      }

      // Cria a reserva definitiva
      return tx.appointment.create({
        data: {
          clientId,
          barberId: availableBarbers[0].id,
          serviceId,
          startTime,
          endTime,
          status: 'SCHEDULED',
        },
        include: {
          client: { select: { name: true, phoneNumber: true } },
          barber: { select: { name: true } },
          service: { select: { name: true } }
        }
      });
    }, {
      isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
    });

    // Despacha o Job assíncrono para notificação
    await this.notificationsService.scheduleWhatsAppNotification({
      appointmentId: appointment.id,
      clientName: appointment.client?.name || 'Cliente',
      phone: appointment.client?.phoneNumber || 'S/N',
      serviceName: appointment.service?.name || 'Serviço',
      barberName: appointment.barber?.name || 'Equipe',
      time: appointment.startTime
    });

    return appointment;
  }

  /**
   * RF02 - Motor de Disponibilidade
   * Retorna os horários disponíveis para um determinado serviço em um determinado dia.
   */
  async getAvailability(dateString: string, serviceId: string, preferredBarberId?: string) {
    const service = await this.prisma.service.findUnique({ where: { id: serviceId } });
    if (!service) throw new NotFoundException('Serviço não encontrado');

    const date = new Date(dateString);
    if (isNaN(date.getTime())) throw new ConflictException('Data inválida');

    // Horário comercial: 09:00 as 18:00
    const startOfDay = new Date(date.getFullYear(), date.getMonth(), date.getDate(), 9, 0, 0);
    const endOfDay = new Date(date.getFullYear(), date.getMonth(), date.getDate(), 18, 0, 0);

    let allBarbers = await this.prisma.user.findMany({ where: { role: 'BARBER' } });
    if (preferredBarberId) {
      allBarbers = allBarbers.filter(b => b.id === preferredBarberId);
    }
    if (allBarbers.length === 0) return [];

    // Busca todos os agendamentos do dia para os barbeiros considerados
    const dayAppointments = await this.prisma.appointment.findMany({
      where: {
        status: 'SCHEDULED',
        startTime: { gte: startOfDay, lt: endOfDay },
        barberId: preferredBarberId ? preferredBarberId : undefined
      },
    });

    const dayBlocks = await this.prisma.scheduleBlock.findMany({
      where: {
        startTime: { lt: endOfDay },
        endTime: { gt: startOfDay },
        barberId: preferredBarberId ? preferredBarberId : undefined
      }
    });

    const availableSlots = [];
    let currentSlot = startOfDay;

    // Incrementos de 30 minutos
    while (currentSlot < endOfDay) {
      const slotEnd = addMinutes(currentSlot, service.durationMinutes);

      if (slotEnd <= endOfDay) {
        // Verifica se há pelo menos UM barbeiro livre neste slot
        const isAnyBarberFree = allBarbers.some((barber) => {
          // Procura se ESSE barbeiro tem um agendamento conflitando
          const hasApptConflict = dayAppointments.some(appt => {
            return appt.barberId === barber.id &&
                   appt.startTime < slotEnd &&
                   appt.endTime > currentSlot;
          });
          
          // Procura se ESSE barbeiro tem um bloqueio de agenda conflitando
          const hasBlockConflict = dayBlocks.some(block => {
            return block.barberId === barber.id &&
                   block.startTime < slotEnd &&
                   block.endTime > currentSlot;
          });

          return !hasApptConflict && !hasBlockConflict;
        });

        if (isAnyBarberFree) {
          availableSlots.push({
            time: currentSlot.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', hour12: false }),
            available: true,
            dateTime: currentSlot.toISOString()
          });
        }
      }
      currentSlot = addMinutes(currentSlot, 30);
    }

    return availableSlots;
  }

  /**
   * RF06 - Atualizar Status do Agendamento
   */
  async updateStatus(appointmentId: string, status: string, userId: string, role: string) {
    const appointment = await this.prisma.appointment.findUnique({ where: { id: appointmentId } });
    if (!appointment) throw new NotFoundException('Agendamento não encontrado');
    
    if (role === 'BARBER' && appointment.barberId !== userId) {
      throw new ConflictException('Sem permissão para alterar este agendamento');
    }
    if (role === 'CLIENT' && appointment.clientId !== userId) {
      throw new ConflictException('Sem permissão para alterar este agendamento');
    }

    if (status === 'COMPLETED') {
      const now = new Date();
      if (now < appointment.startTime) {
        throw new BadRequestException('Não é possível concluir um agendamento antes do seu horário de início.');
      }
    }

    return this.prisma.appointment.update({
      where: { id: appointmentId },
      data: { status: status as any }
    });
  }

  /**
   * RF06 - Métricas do Dia (Faturamento e Concluídos)
   */
  async getTodayMetrics(barberId: string) {
    const today = new Date();
    const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 0, 0, 0);
    const endOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 23, 59, 59);

    const appointments = await this.prisma.appointment.findMany({
      where: {
        barberId,
        startTime: { gte: startOfDay, lt: endOfDay },
      },
      include: { service: true }
    });

    let totalRevenue = 0;
    let completedCount = 0;
    let pendingCount = 0;

    for (const appt of appointments) {
      if (appt.status === 'COMPLETED') {
        completedCount++;
        // Prisma Decimal type handling
        totalRevenue += Number(appt.service.price);
      } else if (appt.status === 'SCHEDULED') {
        pendingCount++;
      }
    }

    return { totalRevenue, completedCount, pendingCount };
  }

  async getAdvancedMetrics(startDateStr: string, endDateStr: string, barberId?: string) {
    if (!startDateStr || !endDateStr) {
      throw new BadRequestException('startDate e endDate são obrigatórios');
    }

    const startDate = new Date(startDateStr);
    const endDate = new Date(endDateStr);
    
    // Configura endDate para o final do dia (23:59:59.999) se for a mesma data
    endDate.setHours(23, 59, 59, 999);

    const whereClause: any = {
      startTime: {
        gte: startDate,
        lte: endDate,
      },
    };

    if (barberId) {
      whereClause.barberId = barberId;
    }

    const appointments = await this.prisma.appointment.findMany({
      where: whereClause,
      include: {
        service: true,
        barber: { select: { name: true, commissionRate: true } },
        client: { select: { name: true, email: true } }
      },
      orderBy: { startTime: 'desc' }
    });

    let totalRevenue = 0;
    let completedCount = 0;
    let totalCommission = 0;
    const details = [];

    for (const appt of appointments) {
      if (appt.status === 'COMPLETED') {
        completedCount++;
        const price = Number(appt.service.price);
        totalRevenue += price;
        
        const rate = appt.barber?.commissionRate ? Number(appt.barber.commissionRate) : 0.50;
        const commission = price * rate;
        totalCommission += commission;

        details.push({
          id: appt.id,
          startTime: appt.startTime,
          clientName: appt.client?.name || appt.client?.email || 'Desconhecido',
          serviceName: appt.service.name,
          price,
          commission,
          barberName: appt.barber?.name || 'Desconhecido'
        });
      }
    }

    return { totalRevenue, totalCommission, completedCount, details };
  }
}
