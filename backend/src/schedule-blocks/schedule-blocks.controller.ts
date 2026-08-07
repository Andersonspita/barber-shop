import { Controller, Post, Get, Delete, Body, Param, Query, UseGuards, Request, BadRequestException } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ScheduleBlocksService } from './schedule-blocks.service';

@Controller('schedule-blocks')
@UseGuards(AuthGuard('jwt'))
export class ScheduleBlocksController {
  constructor(private readonly scheduleBlocksService: ScheduleBlocksService) {}

  @Post()
  async createBlock(@Body() body: { barberId?: string; startTime: string; endTime: string; reason?: string }, @Request() req: any) {
    const isBarberOrAdmin = req.user.role === 'BARBER' || req.user.isAdmin;
    if (!isBarberOrAdmin) throw new BadRequestException('Acesso negado');

    // Se não mandar barberId e for barbeiro, usa o próprio ID
    let targetBarberId = body.barberId;
    if (!targetBarberId) {
      if (req.user.role === 'BARBER') {
        targetBarberId = req.user.sub as string;
      } else {
        throw new BadRequestException('barberId é obrigatório para admin');
      }
    }

    // Apenas admin pode bloquear para outros
    if (targetBarberId !== req.user.sub && !req.user.isAdmin) {
      throw new BadRequestException('Acesso negado');
    }

    return this.scheduleBlocksService.createBlock(
      targetBarberId, 
      new Date(body.startTime), 
      new Date(body.endTime), 
      body.reason
    );
  }

  @Get()
  async getBlocks(@Query('barberId') barberId: string, @Query('start') start: string, @Query('end') end: string, @Request() req: any) {
    let targetBarberId = barberId;
    if (!targetBarberId && req.user.role === 'BARBER') {
      targetBarberId = req.user.sub as string;
    }
    
    if (!targetBarberId) throw new BadRequestException('barberId é obrigatório');

    const startDate = start ? new Date(start) : undefined;
    const endDate = end ? new Date(end) : undefined;

    return this.scheduleBlocksService.getBlocks(targetBarberId, startDate, endDate);
  }

  @Delete(':id')
  async deleteBlock(@Param('id') id: string, @Request() req: any) {
    return this.scheduleBlocksService.deleteBlock(id, req.user.sub, req.user.isAdmin);
  }
}
