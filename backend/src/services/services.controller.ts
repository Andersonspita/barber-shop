import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Put,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AdminOnly } from '../common/roles.guard';
import { UpsertServiceDto } from './dto';

@AdminOnly()
@Controller('admin/services')
export class ServicesController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  async list() {
    return this.prisma.service.findMany({
      orderBy: [{ isActive: 'desc' }, { name: 'asc' }],
      include: { _count: { select: { appointments: true } } },
    });
  }

  @Post()
  async create(@Body() body: UpsertServiceDto) {
    return this.prisma.service.create({
      data: {
        name: body.name.trim(),
        description: body.description?.trim() || null,
        durationMinutes: body.durationMinutes,
        price: body.price,
        isActive: body.isActive ?? true,
      },
    });
  }

  @Put(':id')
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: UpsertServiceDto,
  ) {
    return this.prisma.service.update({
      where: { id },
      data: {
        name: body.name.trim(),
        description: body.description?.trim() || null,
        durationMinutes: body.durationMinutes,
        price: body.price,
        isActive: body.isActive ?? true,
      },
    });
  }

  /**
   * Desativa em vez de excluir. Um serviço já usado em agendamentos não pode
   * sumir sem levar o histórico junto — inativo, ele some da vitrine e da
   * tela de agendamento, e o passado continua auditável.
   */
  @Delete(':id')
  async deactivate(@Param('id', ParseUUIDPipe) id: string) {
    return this.prisma.service.update({
      where: { id },
      data: { isActive: false },
    });
  }
}
