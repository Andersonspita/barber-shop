import { Injectable } from '@nestjs/common';
import { ShopSettings } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

const SETTINGS_ID = 'default';
const CACHE_TTL_MS = 30_000;

/**
 * Configuração única da barbearia. É lida em quase toda requisição de agenda,
 * então fica em cache curto — invalidado na escrita.
 */
@Injectable()
export class ShopSettingsService {
  private cached: ShopSettings | null = null;
  private cachedAt = 0;

  constructor(private readonly prisma: PrismaService) {}

  async get(): Promise<ShopSettings> {
    if (this.cached && Date.now() - this.cachedAt < CACHE_TTL_MS) {
      return this.cached;
    }

    const settings = await this.prisma.shopSettings.upsert({
      where: { id: SETTINGS_ID },
      update: {},
      create: { id: SETTINGS_ID },
    });

    this.cached = settings;
    this.cachedAt = Date.now();
    return settings;
  }

  /** Atalho para o fuso da barbearia, usado por todo o motor de agenda. */
  async timezone(): Promise<string> {
    return (await this.get()).timezone;
  }

  async update(data: Partial<Omit<ShopSettings, 'id' | 'updatedAt'>>) {
    const settings = await this.prisma.shopSettings.upsert({
      where: { id: SETTINGS_ID },
      update: data,
      create: { id: SETTINGS_ID, ...data },
    });
    this.cached = settings;
    this.cachedAt = Date.now();
    return settings;
  }

  /** Recorte público: o que a landing page pode mostrar sem autenticação. */
  async publicInfo() {
    const s = await this.get();
    return {
      name: s.name,
      timezone: s.timezone,
      addressLine: s.addressLine,
      city: s.city,
      mapsUrl: s.mapsUrl,
      phone: s.phone,
      whatsapp: s.whatsapp,
      instagram: s.instagram,
      about: s.about,
      maxAdvanceDays: s.maxAdvanceDays,
      cancellationWindowMinutes: s.cancellationWindowMinutes,
    };
  }
}
