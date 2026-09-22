import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  Request,
} from '@nestjs/common';
import { IsISO8601, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';
import { ScheduleBlocksService } from './schedule-blocks.service';
import { Roles } from '../common/roles.guard';
import { SessionUser } from '../appointments/appointments.service';

class CreateBlockDto {
  @IsOptional() @IsUUID() barberId?: string;
  @IsISO8601() startTime!: string;
  @IsISO8601() endTime!: string;
  @IsOptional() @IsString() @MaxLength(200) reason?: string;
}

class ListBlocksQueryDto {
  @IsOptional() @IsUUID() barberId?: string;
  @IsOptional() @IsISO8601() start?: string;
  @IsOptional() @IsISO8601() end?: string;
}

@Roles('BARBER')
@Controller('schedule-blocks')
export class ScheduleBlocksController {
  constructor(private readonly scheduleBlocks: ScheduleBlocksService) {}

  @Post()
  async create(
    @Body() body: CreateBlockDto,
    @Request() req: { user: SessionUser },
  ) {
    const targetBarberId = body.barberId ?? req.user.id;

    if (targetBarberId !== req.user.id && !req.user.isAdmin) {
      throw new ForbiddenException(
        'Apenas administradores bloqueiam a agenda de outro profissional.',
      );
    }

    return this.scheduleBlocks.createBlock(
      req.user.shopId,
      targetBarberId,
      new Date(body.startTime),
      new Date(body.endTime),
      body.reason,
    );
  }

  @Get()
  async list(
    @Query() query: ListBlocksQueryDto,
    @Request() req: { user: SessionUser },
  ) {
    const targetBarberId = query.barberId ?? req.user.id;

    if (targetBarberId !== req.user.id && !req.user.isAdmin) {
      throw new ForbiddenException(
        'Você só pode consultar os próprios bloqueios.',
      );
    }
    if (!targetBarberId) {
      throw new BadRequestException('Informe o profissional.');
    }

    return this.scheduleBlocks.getBlocks(
      req.user.shopId,
      targetBarberId,
      query.start ? new Date(query.start) : undefined,
      query.end ? new Date(query.end) : undefined,
    );
  }

  @Delete(':id')
  async remove(
    @Param('id', ParseUUIDPipe) id: string,
    @Request() req: { user: SessionUser },
  ) {
    return this.scheduleBlocks.deleteBlock(
      req.user.shopId,
      id,
      req.user.id,
      req.user.isAdmin,
    );
  }
}
