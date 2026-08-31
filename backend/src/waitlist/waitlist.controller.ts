import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Request,
} from '@nestjs/common';
import { IsOptional, IsString, IsUUID } from 'class-validator';
import { PrismaService } from '../prisma/prisma.service';
import { Auth } from '../common/roles.guard';
import { SessionUser } from '../appointments/appointments.service';
import { dateOnlyToUtcMidnight, parseDateOnly } from '../common/time.util';

class JoinWaitlistDto {
  @IsUUID() serviceId!: string;
  @IsString() date!: string;
  @IsOptional() @IsUUID() barberId?: string;
}

/**
 * "Avise-me se vagar". Antes, um dia lotado terminava a conversa com um
 * "Tudo lotado para este dia" — e a intenção de compra se perdia ali.
 */
@Auth()
@Controller('waitlist')
export class WaitlistController {
  constructor(private readonly prisma: PrismaService) {}

  @Get('me')
  async listMine(@Request() req: { user: SessionUser }) {
    return this.prisma.waitlistEntry.findMany({
      where: { clientId: req.user.id, notifiedAt: null },
      include: {
        service: { select: { name: true } },
        barber: { select: { name: true } },
      },
      orderBy: { date: 'asc' },
    });
  }

  @Post()
  async join(
    @Body() body: JoinWaitlistDto,
    @Request() req: { user: SessionUser },
  ) {
    const date = dateOnlyToUtcMidnight(parseDateOnly(body.date));

    return this.prisma.waitlistEntry.upsert({
      where: {
        clientId_serviceId_date: {
          clientId: req.user.id,
          serviceId: body.serviceId,
          date,
        },
      },
      update: { barberId: body.barberId ?? null, notifiedAt: null },
      create: {
        clientId: req.user.id,
        serviceId: body.serviceId,
        barberId: body.barberId ?? null,
        date,
      },
    });
  }

  @Delete(':id')
  async leave(
    @Param('id', ParseUUIDPipe) id: string,
    @Request() req: { user: SessionUser },
  ) {
    await this.prisma.waitlistEntry.deleteMany({
      where: { id, clientId: req.user.id },
    });
    return { id };
  }
}
