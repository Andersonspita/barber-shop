import { Controller, Get } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Controller()
export class PublicCatalogController {
  constructor(private readonly prisma: PrismaService) {}

  @Get('services')
  async getServices() {
    return this.prisma.service.findMany({
      orderBy: { name: 'asc' },
      select: {
        id: true,
        name: true,
        durationMinutes: true,
        price: true,
      },
    });
  }

  @Get('barbers')
  async getBarbers() {
    return this.prisma.user.findMany({
      where: { role: 'BARBER' },
      orderBy: { name: 'asc' },
      select: {
        id: true,
        name: true,
      },
    });
  }
}
