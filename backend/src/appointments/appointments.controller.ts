import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Request,
} from '@nestjs/common';
import { AppointmentsService, SessionUser } from './appointments.service';
import { AvailabilityService } from '../availability/availability.service';
import { AdminOnly, Auth, Roles } from '../common/roles.guard';
import {
  AgendaQueryDto,
  AvailabilityQueryDto,
  BookAppointmentDto,
  CreateReviewDto,
  ListAppointmentsQueryDto,
  MetricsQueryDto,
  RescheduleAppointmentDto,
  UpdateStatusDto,
  WalkInAppointmentDto,
} from './dto';

@Controller('appointments')
export class AppointmentsController {
  constructor(
    private readonly appointments: AppointmentsService,
    private readonly availability: AvailabilityService,
  ) {}

  /** Pública: a landing page mostra os horários antes de pedir login. */
  @Get('availability')
  async getAvailability(@Query() query: AvailabilityQueryDto) {
    return this.availability.getAvailability(
      query.date,
      query.serviceId,
      query.barberId,
    );
  }

  @Auth()
  @Post()
  async book(@Body() body: BookAppointmentDto, @Request() req: AuthedRequest) {
    const appointment = await this.appointments.book({
      clientId: req.user.id,
      serviceId: body.serviceId,
      startTime: new Date(body.startTime),
      preferredBarberId: body.barberId,
      notes: body.notes,
    });

    return { message: 'Agendamento confirmado!', appointment };
  }

  /** Encaixe registrado pelo barbeiro no balcão. */
  @Roles('BARBER')
  @Post('walk-in')
  async walkIn(
    @Body() body: WalkInAppointmentDto,
    @Request() req: AuthedRequest,
  ) {
    const appointment = await this.appointments.createWalkIn(req.user, {
      serviceId: body.serviceId,
      startTime: new Date(body.startTime),
      barberId: body.barberId,
      clientId: body.clientId,
      clientName: body.clientName,
      clientPhone: body.clientPhone,
      notes: body.notes,
      force: body.force,
    });

    return { message: 'Atendimento registrado!', appointment };
  }

  @Auth()
  @Get('me')
  async listMine(
    @Query() query: ListAppointmentsQueryDto,
    @Request() req: AuthedRequest,
  ) {
    return this.appointments.listForUser(req.user, query);
  }

  @AdminOnly()
  @Get('agenda')
  async agenda(@Query() query: AgendaQueryDto) {
    return this.appointments.shopAgenda(query.date, query.barberId);
  }

  @Roles('BARBER')
  @Get('metrics/today')
  async todayMetrics(@Request() req: AuthedRequest) {
    return this.appointments.getTodayMetrics(req.user.id);
  }

  @Roles('BARBER')
  @Get('metrics/advanced')
  async advancedMetrics(
    @Query() query: MetricsQueryDto,
    @Request() req: AuthedRequest,
  ) {
    // Quem não é admin só enxerga os próprios números.
    const barberId = req.user.isAdmin ? query.barberId : req.user.id;
    return this.appointments.getAdvancedMetrics(
      query.startDate,
      query.endDate,
      barberId,
    );
  }

  @Auth()
  @Patch(':id/reschedule')
  async reschedule(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: RescheduleAppointmentDto,
    @Request() req: AuthedRequest,
  ) {
    const appointment = await this.appointments.reschedule(
      id,
      new Date(body.startTime),
      req.user,
      body.barberId,
    );
    return { message: 'Agendamento remarcado!', appointment };
  }

  @Auth()
  @Patch(':id/status')
  async updateStatus(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: UpdateStatusDto,
    @Request() req: AuthedRequest,
  ) {
    return this.appointments.updateStatus(id, body.status, req.user);
  }

  @Auth()
  @Post(':id/review')
  async review(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: CreateReviewDto,
    @Request() req: AuthedRequest,
  ) {
    return this.appointments.createReview(
      id,
      req.user,
      body.rating,
      body.comment,
    );
  }
}

interface AuthedRequest {
  user: SessionUser;
}
