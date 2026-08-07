import { Controller, Get, Post, Put, Delete, Body, Param, UseGuards, Request, BadRequestException } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { PrismaService } from '../prisma/prisma.service';

@Controller('admin/services')
export class ServicesController {
  constructor(private readonly prisma: PrismaService) {}

  @UseGuards(AuthGuard('jwt'))
  @Get()
  async getAllServices(@Request() req: any) {
    if (!req.user.isAdmin) throw new BadRequestException('Acesso negado');
    return this.prisma.service.findMany({ orderBy: { name: 'asc' } });
  }

  @UseGuards(AuthGuard('jwt'))
  @Post()
  async createService(@Body() body: { name: string; durationMinutes: number; price: number }, @Request() req: any) {
    if (!req.user.isAdmin) throw new BadRequestException('Acesso negado');
    return this.prisma.service.create({
      data: {
        name: body.name,
        durationMinutes: Number(body.durationMinutes),
        price: Number(body.price),
      },
    });
  }

  @UseGuards(AuthGuard('jwt'))
  @Put(':id')
  async updateService(@Param('id') id: string, @Body() body: { name: string; durationMinutes: number; price: number }, @Request() req: any) {
    if (!req.user.isAdmin) throw new BadRequestException('Acesso negado');
    return this.prisma.service.update({
      where: { id },
      data: {
        name: body.name,
        durationMinutes: Number(body.durationMinutes),
        price: Number(body.price),
      },
    });
  }

  @UseGuards(AuthGuard('jwt'))
  @Delete(':id')
  async deleteService(@Param('id') id: string, @Request() req: any) {
    if (!req.user.isAdmin) throw new BadRequestException('Acesso negado');
    return this.prisma.service.delete({ where: { id } });
  }
}
