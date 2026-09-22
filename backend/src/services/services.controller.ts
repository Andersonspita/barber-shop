import {
  Body,
  Controller,
  Delete,
  Get,
  NotFoundException,
  Param,
  ParseUUIDPipe,
  Post,
  Put,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AdminOnly } from '../common/roles.guard';
import { ShopId } from '../common/shop-context';
import { UpsertServiceDto } from './dto';

@AdminOnly()
@Controller('admin/services')
export class ServicesController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  async list(@ShopId() shopId: string) {
    return this.prisma.service.findMany({
      where: { shopId },
      orderBy: [{ isActive: 'desc' }, { name: 'asc' }],
      include: { _count: { select: { appointments: true } } },
    });
  }

  @Post()
  async create(@ShopId() shopId: string, @Body() body: UpsertServiceDto) {
    return this.prisma.service.create({
      data: {
        shopId,
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
    @ShopId() shopId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: UpsertServiceDto,
  ) {
    await this.assertOwned(shopId, id);
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
  async deactivate(
    @ShopId() shopId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    await this.assertOwned(shopId, id);
    return this.prisma.service.update({
      where: { id },
      data: { isActive: false },
    });
  }

  /** Serviço de outra barbearia responde como inexistente. */
  private async assertOwned(shopId: string, id: string) {
    const found = await this.prisma.service.findFirst({
      where: { id, shopId },
      select: { id: true },
    });
    if (!found) throw new NotFoundException('Serviço não encontrado.');
  }
}
