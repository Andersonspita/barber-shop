import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Put,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AdminOnly } from '../common/roles.guard';
import { dateOnlyToUtcMidnight, parseDateOnly } from '../common/time.util';
import { ShopSettingsService } from './shop-settings.service';
import { UpdateShopSettingsDto, UpsertHolidayDto } from './dto';

@Controller()
export class ShopController {
  constructor(
    private readonly settings: ShopSettingsService,
    private readonly prisma: PrismaService,
  ) {}

  /** Dados que a landing page mostra sem login. */
  @Get('shop')
  async getPublicShop() {
    return this.settings.publicInfo();
  }

  @AdminOnly()
  @Get('admin/shop')
  async getSettings() {
    return this.settings.get();
  }

  @AdminOnly()
  @Put('admin/shop')
  async updateSettings(@Body() body: UpdateShopSettingsDto) {
    if (body.timezone && !isValidTimezone(body.timezone)) {
      throw new BadRequestException(
        `Fuso "${body.timezone}" não é reconhecido. Use um identificador IANA, como America/Sao_Paulo.`,
      );
    }
    return this.settings.update(body);
  }

  @AdminOnly()
  @Get('admin/holidays')
  async listHolidays() {
    return this.prisma.holiday.findMany({ orderBy: { date: 'asc' } });
  }

  @AdminOnly()
  @Post('admin/holidays')
  async createHoliday(@Body() body: UpsertHolidayDto) {
    const date = dateOnlyToUtcMidnight(parseDateOnly(body.date));
    return this.prisma.holiday.upsert({
      where: { date },
      update: { description: body.description },
      create: { date, description: body.description },
    });
  }

  @AdminOnly()
  @Delete('admin/holidays/:id')
  async deleteHoliday(@Param('id') id: string) {
    await this.prisma.holiday.delete({ where: { id } });
    return { id };
  }
}

function isValidTimezone(tz: string): boolean {
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}
