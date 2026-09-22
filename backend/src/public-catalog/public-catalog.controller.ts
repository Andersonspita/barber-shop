import { Controller, Get } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ShopId } from '../common/shop-context';

/**
 * O que a landing page consome sem autenticação. Tudo aqui é recorte
 * explícito — nenhum campo sensível de usuário sai por estas rotas — e sempre
 * da barbearia informada no cabeçalho `X-Shop`.
 */
@Controller()
export class PublicCatalogController {
  constructor(private readonly prisma: PrismaService) {}

  @Get('services')
  async getServices(@ShopId() shopId: string) {
    return this.prisma.service.findMany({
      where: { shopId, isActive: true },
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
  async getBarbers(@ShopId() shopId: string) {
    const barbers = await this.prisma.user.findMany({
      where: { shopId, role: 'BARBER', isActive: true },
      orderBy: { name: 'asc' },
      select: { id: true, name: true, photoUrl: true, bio: true },
    });

    // Antes o agrupamento lia todas as avaliações da base. Agora a consulta
    // já sai recortada pelos barbeiros desta barbearia.
    const reviews = await this.prisma.review.findMany({
      where: {
        appointment: { shopId, barberId: { in: barbers.map((b) => b.id) } },
      },
      select: { rating: true, appointment: { select: { barberId: true } } },
    });

    const byBarber = new Map<string, { sum: number; count: number }>();
    for (const review of reviews) {
      const barberId = review.appointment.barberId;
      const bucket = byBarber.get(barberId) ?? { sum: 0, count: 0 };
      bucket.sum += review.rating;
      bucket.count += 1;
      byBarber.set(barberId, bucket);
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
