import { Controller, Get } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

/**
 * O que a landing page consome sem autenticação. Tudo aqui é recorte
 * explícito — nenhum campo sensível de usuário sai por estas rotas.
 */
@Controller()
export class PublicCatalogController {
  constructor(private readonly prisma: PrismaService) {}

  @Get('services')
  async getServices() {
    return this.prisma.service.findMany({
      where: { isActive: true },
      orderBy: { name: 'asc' },
      select: {
        id: true,
        name: true,
        description: true,
        durationMinutes: true,
        price: true,
      },
    });
  }

  @Get('barbers')
  async getBarbers() {
    const barbers = await this.prisma.user.findMany({
      where: { role: 'BARBER', isActive: true },
      orderBy: { name: 'asc' },
      select: { id: true, name: true, photoUrl: true, bio: true },
    });

    const ratings = await this.prisma.review.groupBy({
      by: ['appointmentId'],
      _avg: { rating: true },
    });

    // O agrupamento por barbeiro precisa passar pelo agendamento, então a
    // média é montada aqui em vez de num groupBy direto.
    const appointmentIds = ratings.map((r) => r.appointmentId);
    const appointments = appointmentIds.length
      ? await this.prisma.appointment.findMany({
          where: { id: { in: appointmentIds } },
          select: { id: true, barberId: true },
        })
      : [];

    const byBarber = new Map<string, { sum: number; count: number }>();
    for (const rating of ratings) {
      const appointment = appointments.find(
        (a) => a.id === rating.appointmentId,
      );
      if (!appointment) continue;

      const bucket = byBarber.get(appointment.barberId) ?? { sum: 0, count: 0 };
      bucket.sum += rating._avg.rating ?? 0;
      bucket.count += 1;
      byBarber.set(appointment.barberId, bucket);
    }

    return barbers.map((barber) => {
      const stats = byBarber.get(barber.id);
      return {
        ...barber,
        rating: stats && stats.count > 0 ? stats.sum / stats.count : null,
        reviewCount: stats?.count ?? 0,
      };
    });
  }
}
