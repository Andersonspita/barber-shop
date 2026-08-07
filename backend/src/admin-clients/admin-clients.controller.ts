import { Controller, Get, Post, Put, Delete, Body, Param, UseGuards, Request, BadRequestException } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { PrismaService } from '../prisma/prisma.service';

@Controller('admin/clients')
export class AdminClientsController {
  constructor(private readonly prisma: PrismaService) {}

  @UseGuards(AuthGuard('jwt'))
  @Get()
  async getAllClients(@Request() req: any) {
    if (!req.user.isAdmin) throw new BadRequestException('Acesso negado');
    return this.prisma.user.findMany({ 
      where: { role: 'CLIENT' },
      orderBy: { name: 'asc' },
      select: {
        id: true,
        name: true,
        email: true,
        phoneNumber: true,
        createdAt: true,
      }
    });
  }

  @UseGuards(AuthGuard('jwt'))
  @Post()
  async createClient(@Body() body: { name: string; email: string; phoneNumber?: string; birthDate?: string }, @Request() req: any) {
    if (!req.user.isAdmin) throw new BadRequestException('Acesso negado');
    
    // Senha genérica para clientes cadastrados pelo admin
    const genericPassword = 'Mudar@123';

    const exists = await this.prisma.user.findUnique({ where: { email: body.email } });
    if (exists) throw new BadRequestException('E-mail já cadastrado.');

    return this.prisma.user.create({
      data: {
        name: body.name,
        email: body.email,
        phoneNumber: body.phoneNumber || null,
        birthDate: body.birthDate ? new Date(body.birthDate) : null,
        passwordHash: genericPassword,
        role: 'CLIENT',
      },
      select: {
        id: true,
        name: true,
        email: true,
        phoneNumber: true,
        birthDate: true,
      }
    });
  }

  @UseGuards(AuthGuard('jwt'))
  @Put(':id')
  async updateClient(@Param('id') id: string, @Body() body: { name: string; email: string; phoneNumber?: string; birthDate?: string }, @Request() req: any) {
    if (!req.user.isAdmin) throw new BadRequestException('Acesso negado');
    return this.prisma.user.update({
      where: { id },
      data: {
        name: body.name,
        email: body.email,
        phoneNumber: body.phoneNumber || null,
        birthDate: body.birthDate ? new Date(body.birthDate) : null,
      },
      select: {
        id: true,
        name: true,
        email: true,
        phoneNumber: true,
      }
    });
  }

  @UseGuards(AuthGuard('jwt'))
  @Delete(':id')
  async deleteClient(@Param('id') id: string, @Request() req: any) {
    if (!req.user.isAdmin) throw new BadRequestException('Acesso negado');
    return this.prisma.user.delete({ 
      where: { id },
      select: { id: true }
    });
  }

  @UseGuards(AuthGuard('jwt'))
  @Get(':id/history')
  async getClientHistory(@Param('id') id: string, @Request() req: any) {
    if (!req.user.isAdmin) throw new BadRequestException('Acesso negado');
    
    const client = await this.prisma.user.findUnique({
      where: { id, role: 'CLIENT' },
      select: { name: true, email: true, phoneNumber: true, createdAt: true }
    });

    if (!client) throw new BadRequestException('Cliente não encontrado');

    const appointments = await this.prisma.appointment.findMany({
      where: { clientId: id },
      include: {
        service: { select: { name: true, price: true } },
        barber: { select: { name: true } }
      },
      orderBy: { startTime: 'desc' }
    });

    let totalSpent = 0;
    let completedCount = 0;
    let noShowCount = 0;

    const history = appointments.map(appt => {
      if (appt.status === 'COMPLETED') {
        completedCount++;
        totalSpent += Number(appt.service.price);
      } else if (appt.status === 'NO_SHOW' || appt.status === 'CANCELLED') {
        noShowCount++;
      }

      return {
        id: appt.id,
        date: appt.startTime,
        service: appt.service.name,
        price: Number(appt.service.price),
        barber: appt.barber?.name || 'Desconhecido',
        status: appt.status
      };
    });

    return {
      client,
      metrics: {
        totalSpent,
        completedCount,
        noShowCount,
        totalAppointments: appointments.length
      },
      history
    };
  }
}
