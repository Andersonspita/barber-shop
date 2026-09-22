import {
  BadRequestException,
  Body,
  Controller,
  Get,
  NotFoundException,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../prisma/prisma.service';
import { ShopSettingsService } from '../shop/shop-settings.service';
import { assertValidSlug } from '../common/shop-context';
import { generateTemporaryPassword } from '../common/password.util';
import { PlatformGuard } from './platform.guard';
import { CreateShopDto, UpdateShopDto } from './dto';

/** Jornada inicial do primeiro admin: seg-sex 09h-18h, sábado 09h-14h. */
const DEFAULT_SHIFTS = [
  ...[1, 2, 3, 4, 5].map((weekday) => ({
    weekday,
    startMinute: 9 * 60,
    endMinute: 18 * 60,
  })),
  { weekday: 6, startMinute: 9 * 60, endMinute: 14 * 60 },
];

/**
 * Operação da plataforma: cadastrar barbearias, suspender e ligar o WhatsApp
 * de cada uma. O limite de requisições é estreito porque a rota é protegida
 * por uma chave só.
 */
@Throttle({ default: { limit: 30, ttl: 60_000 } })
@UseGuards(PlatformGuard)
@Controller('platform/shops')
export class PlatformController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly shops: ShopSettingsService,
  ) {}

  @Get()
  async list() {
    const shops = await this.prisma.shop.findMany({
      orderBy: { createdAt: 'asc' },
      select: {
        id: true,
        slug: true,
        name: true,
        city: true,
        isActive: true,
        whatsappInstance: true,
        createdAt: true,
        _count: { select: { appointments: true } },
      },
    });

    // Contagem por papel: o _count do Prisma não filtra por coluna.
    const people = await this.prisma.user.groupBy({
      by: ['shopId', 'role'],
      where: { isActive: true },
      _count: { _all: true },
    });

    return shops.map(({ _count, ...shop }) => {
      const count = (role: string) =>
        people.find((p) => p.shopId === shop.id && p.role === role)?._count
          ._all ?? 0;
      return {
        ...shop,
        barbers: count('BARBER'),
        clients: count('CLIENT'),
        appointments: _count.appointments,
      };
    });
  }

  /**
   * Cria a barbearia já com o primeiro administrador. Sem ele ninguém
   * conseguiria entrar no painel para cadastrar equipe e serviços.
   */
  @Post()
  async create(@Body() body: CreateShopDto) {
    const slug = assertValidSlug(body.slug);
    if (body.timezone && !isValidTimezone(body.timezone)) {
      throw new BadRequestException(`Fuso "${body.timezone}" não reconhecido.`);
    }
    await this.assertSlugAvailable(slug);

    const temporaryPassword = generateTemporaryPassword();
    const passwordHash = await bcrypt.hash(temporaryPassword, 10);

    const { shop, admin } = await this.prisma.$transaction(async (tx) => {
      const shop = await tx.shop.create({
        data: {
          slug,
          name: body.name.trim(),
          city: body.city?.trim() || null,
          ...(body.timezone ? { timezone: body.timezone } : {}),
        },
      });

      const admin = await tx.user.create({
        data: {
          shopId: shop.id,
          name: body.adminName.trim(),
          email: body.adminEmail,
          phoneNumber: body.adminPhone?.trim() || null,
          passwordHash,
          role: 'BARBER',
          isAdmin: true,
          mustChangePassword: true,
          commissionRate: 0.5,
        },
        select: { id: true, name: true, email: true },
      });

      await tx.workingHours.createMany({
        data: DEFAULT_SHIFTS.map((shift) => ({ ...shift, barberId: admin.id })),
      });

      return { shop, admin };
    });

    return {
      shop: { id: shop.id, slug: shop.slug, name: shop.name },
      admin: { ...admin, temporaryPassword },
    };
  }

  @Patch(':id')
  async update(@Param('id') id: string, @Body() body: UpdateShopDto) {
    const existing = await this.prisma.shop.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Barbearia não encontrada.');

    const slug =
      body.slug !== undefined ? assertValidSlug(body.slug) : undefined;
    if (slug && slug !== existing.slug) await this.assertSlugAvailable(slug);

    const shop = await this.prisma.shop.update({
      where: { id },
      data: {
        ...(body.name !== undefined ? { name: body.name.trim() } : {}),
        ...(slug !== undefined ? { slug } : {}),
        ...(body.isActive !== undefined ? { isActive: body.isActive } : {}),
        ...(body.whatsappInstance !== undefined
          ? { whatsappInstance: body.whatsappInstance.trim() || null }
          : {}),
      },
      select: {
        id: true,
        slug: true,
        name: true,
        isActive: true,
        whatsappInstance: true,
      },
    });

    // Suspensão e troca de slug precisam valer já, não em 30 segundos.
    this.shops.forget(id);
    return shop;
  }

  private async assertSlugAvailable(slug: string) {
    const taken = await this.prisma.shop.findUnique({
      where: { slug },
      select: { id: true },
    });
    if (taken) {
      throw new BadRequestException(`O endereço "${slug}" já está em uso.`);
    }
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
