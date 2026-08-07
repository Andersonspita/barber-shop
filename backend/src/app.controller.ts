import { Controller, Get } from '@nestjs/common';
import { AppService } from './app.service';
import { PrismaService } from './prisma/prisma.service';

@Controller()
export class AppController {
  constructor(
    private readonly appService: AppService,
    private readonly prisma: PrismaService
  ) {}

  @Get()
  getHello(): string {
    return this.appService.getHello();
  }

  @Get('services')
  async getServices() {
    return this.prisma.service.findMany({
      orderBy: { name: 'asc' }
    });
  }

  @Get('barbers')
  async getBarbers() {
    return this.prisma.user.findMany({
      where: { role: 'BARBER' },
      select: { id: true, name: true },
      orderBy: { name: 'asc' }
    });
  }
}
