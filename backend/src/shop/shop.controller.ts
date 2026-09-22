import {
  BadRequestException,
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
import { Shop } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AdminOnly } from '../common/roles.guard';
import { ShopId } from '../common/shop-context';
import { dateOnlyToUtcMidnight, parseDateOnly } from '../common/time.util';
import { ShopSettingsService } from './shop-settings.service';
import { UpdateShopSettingsDto, UpsertHolidayDto } from './dto';

@Controller()
export class ShopController {
  constructor(
    private readonly settings: ShopSettingsService,
    private readonly prisma: PrismaService,
  ) {}

  /**
   * Diretório das barbearias ativas: alimenta a página inicial da plataforma
   * e o sitemap. Só o que já é público na vitrine de cada uma.
   */
  @Get('shops')
  async directory() {
    return this.prisma.shop.findMany({
      where: { isActive: true },
      orderBy: { name: 'asc' },
      select: { slug: true, name: true, city: true, about: true },
    });
  }

  /** Dados que a landing page da barbearia mostra sem login. */
  @Get('shop')
  async getPublicShop(@ShopId() shopId: string) {
    return this.settings.publicInfo(shopId);
  }

  @AdminOnly()
  @Get('admin/shop')
  async getSettings(@ShopId() shopId: string) {
    return withoutInternals(await this.settings.get(shopId));
  }

  @AdminOnly()
  @Put('admin/shop')
  async updateSettings(
    @ShopId() shopId: string,
    @Body() body: UpdateShopSettingsDto,
  ) {
    if (body.timezone && !isValidTimezone(body.timezone)) {
      throw new BadRequestException(
        `Fuso "${body.timezone}" não é reconhecido. Use um identificador IANA, como America/Sao_Paulo.`,
      );
    }
    return withoutInternals(await this.settings.update(shopId, body));
  }

  @AdminOnly()
  @Get('admin/holidays')
  async listHolidays(@ShopId() shopId: string) {
    return this.prisma.holiday.findMany({
      where: { shopId },
      orderBy: { date: 'asc' },
    });
  }

  @AdminOnly()
  @Post('admin/holidays')
  async createHoliday(
    @ShopId() shopId: string,
    @Body() body: UpsertHolidayDto,
  ) {
    const date = dateOnlyToUtcMidnight(parseDateOnly(body.date));
    return this.prisma.holiday.upsert({
      where: { shopId_date: { shopId, date } },
      update: { description: body.description },
      create: { shopId, date, description: body.description },
    });
  }

  @AdminOnly()
  @Delete('admin/holidays/:id')
  async deleteHoliday(
    @ShopId() shopId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    const { count } = await this.prisma.holiday.deleteMany({
      where: { id, shopId },
    });
    if (count === 0) throw new NotFoundException('Feriado não encontrado.');
    return { id };
  }
}

/**
 * A instância de WhatsApp é configurada pela plataforma, não pelo admin da
 * barbearia, então não sai no painel dele.
 */
function withoutInternals(shop: Shop): Omit<Shop, 'whatsappInstance'> {
  const { whatsappInstance, ...rest } = shop;
  void whatsappInstance;
  return rest;
}

function isValidTimezone(tz: string): boolean {
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}
