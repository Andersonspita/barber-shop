import { Controller, Post, Body, Get, UseGuards, Request, Query, BadRequestException, Patch, Param } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { AppointmentsService } from './appointments.service';

@Controller('appointments')
export class AppointmentsController {
  constructor(private readonly appointmentsService: AppointmentsService) {}

  @Get('availability')
  async getAvailability(
    @Query('date') date: string, 
    @Query('serviceId') serviceId: string,
    @Query('barberId') barberId?: string
  ) {
    if (!date || !serviceId) {
      throw new BadRequestException('Parâmetros date e serviceId são obrigatórios.');
    }
    return this.appointmentsService.getAvailability(date, serviceId, barberId);
  }

  @UseGuards(AuthGuard('jwt'))
  @Post('dynamic')
  async bookDynamic(@Body() body: { serviceId: string; startTime: string; barberId?: string }, @Request() req: any) {
    const startTimeDate = new Date(body.startTime);
    if (isNaN(startTimeDate.getTime())) {
      throw new BadRequestException('Data inválida');
    }
    const appt = await this.appointmentsService.bookAnyAvailableBarber(
      req.user.id,
      body.serviceId,
      startTimeDate,
      body.barberId
    );
    return { message: 'Agendamento confirmado!', appointmentId: appt.id };
  }

  @UseGuards(AuthGuard('jwt'))
  @Get('metrics/today')
  async getTodayMetrics(@Request() req: any) {
    if (req.user.role !== 'BARBER') throw new BadRequestException('Apenas barbeiros podem ver métricas.');
    return this.appointmentsService.getTodayMetrics(req.user.id);
  }

  @UseGuards(AuthGuard('jwt'))
  @Get('metrics/advanced')
  async getAdvancedMetrics(
    @Request() req: any,
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string,
    @Query('barberId') barberId?: string
  ) {
    if (req.user.role !== 'BARBER') throw new BadRequestException('Acesso negado.');
    
    // Se não for admin, força a buscar os dados de si mesmo
    const targetBarberId = req.user.isAdmin ? (barberId || undefined) : req.user.id;
    
    return this.appointmentsService.getAdvancedMetrics(startDate, endDate, targetBarberId);
  }

  @UseGuards(AuthGuard('jwt'))
  @Get('me')
  async getMyAppointments(@Request() req: any) {
    const prisma = (this.appointmentsService as any).prisma;
    // Retorna todos os agendamentos do barbeiro logado (ou do cliente, dependendo do role)
    const appointments = await prisma.appointment.findMany({
      where: req.user.role === 'BARBER' ? { barberId: req.user.id } : { clientId: req.user.id },
      include: {
        service: true,
        client: { select: { name: true, email: true } },
      },
      orderBy: { startTime: 'asc' }
    });
    return appointments;
  }

  @UseGuards(AuthGuard('jwt'))
  @Patch(':id/status')
  async updateStatus(
    @Param('id') id: string,
    @Body('status') status: string,
    @Request() req: any
  ) {
    if (req.user.role === 'CLIENT' && status !== 'CANCELLED') {
      throw new BadRequestException('Clientes só podem cancelar agendamentos.');
    }
    return this.appointmentsService.updateStatus(id, status, req.user.id, req.user.role);
  }
}
