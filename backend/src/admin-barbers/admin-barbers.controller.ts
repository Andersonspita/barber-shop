import { Controller, Get, Post, Put, Delete, Body, Param, UseGuards, Request, BadRequestException } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { PrismaService } from '../prisma/prisma.service';

@Controller('admin/barbers')
export class AdminBarbersController {
  constructor(private readonly prisma: PrismaService) {}

  @UseGuards(AuthGuard('jwt'))
  @Get()
  async getAllBarbers(@Request() req: any) {
    if (!req.user.isAdmin) throw new BadRequestException('Acesso negado');
    return this.prisma.user.findMany({ 
      where: { role: 'BARBER' },
      orderBy: { name: 'asc' },
      select: {
        id: true,
        name: true,
        email: true,
        phoneNumber: true,
        isAdmin: true,
        commissionRate: true,
        createdAt: true,
      }
    });
  }

  @UseGuards(AuthGuard('jwt'))
  @Post()
  async createBarber(@Body() body: { name: string; email: string; phoneNumber?: string; isAdmin?: boolean; commissionRate?: number }, @Request() req: any) {
    if (!req.user.isAdmin) throw new BadRequestException('Acesso negado');
    
    const genericPassword = 'Mudar@123';

    const exists = await this.prisma.user.findUnique({ where: { email: body.email } });
    if (exists) throw new BadRequestException('E-mail já cadastrado.');

    return this.prisma.user.create({
      data: {
        name: body.name,
        email: body.email,
        phoneNumber: body.phoneNumber || null,
        passwordHash: genericPassword,
        role: 'BARBER',
        isAdmin: body.isAdmin || false,
        commissionRate: body.commissionRate ?? 0.50,
      },
      select: {
        id: true,
        name: true,
        email: true,
        phoneNumber: true,
        isAdmin: true,
        commissionRate: true,
      }
    });
  }

  @UseGuards(AuthGuard('jwt'))
  @Put(':id')
  async updateBarber(@Param('id') id: string, @Body() body: { name: string; email: string; phoneNumber?: string; isAdmin?: boolean; commissionRate?: number }, @Request() req: any) {
    if (!req.user.isAdmin) throw new BadRequestException('Acesso negado');
    return this.prisma.user.update({
      where: { id },
      data: {
        name: body.name,
        email: body.email,
        phoneNumber: body.phoneNumber || null,
        isAdmin: body.isAdmin || false,
        commissionRate: body.commissionRate ?? 0.50,
      },
      select: {
        id: true,
        name: true,
        email: true,
        phoneNumber: true,
        isAdmin: true,
        commissionRate: true,
      }
    });
  }

  @UseGuards(AuthGuard('jwt'))
  @Delete(':id')
  async deleteBarber(@Param('id') id: string, @Request() req: any) {
    if (!req.user.isAdmin) throw new BadRequestException('Acesso negado');
    return this.prisma.user.delete({ 
      where: { id },
      select: { id: true }
    });
  }
}
