import { Injectable, NotFoundException } from '@nestjs/common';
import { Shop } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

const CACHE_TTL_MS = 30_000;

/** Campos que o admin da barbearia pode editar pelo painel. */
export type ShopSettingsUpdate = Partial<
  Omit<
    Shop,
    'id' | 'slug' | 'isActive' | 'whatsappInstance' | 'createdAt' | 'updatedAt'
  >
>;

/**
 * Configuração de cada barbearia. É lida em quase toda requisição de agenda,
 * então fica em cache curto por id e por slug — invalidado na escrita.
 *
 * Antes do multi-tenant havia uma linha só (id = "default"); agora toda
 * leitura exige dizer de qual barbearia se trata.
 */
@Injectable()
export class ShopSettingsService {
  private readonly byId = new Map<string, { shop: Shop; at: number }>();
  private readonly idBySlug = new Map<string, string>();

  constructor(private readonly prisma: PrismaService) {}

  async get(shopId: string): Promise<Shop> {
    const hit = this.byId.get(shopId);
    if (hit && Date.now() - hit.at < CACHE_TTL_MS) return hit.shop;

    const shop = await this.prisma.shop.findUnique({ where: { id: shopId } });
    if (!shop) throw new NotFoundException('Barbearia não encontrada.');
    return this.remember(shop);
  }

  /** Barbearia pelo slug da URL, ou `null` se não existir. */
  async findBySlug(slug: string): Promise<Shop | null> {
    const cachedId = this.idBySlug.get(slug);
    if (cachedId) {
      const hit = this.byId.get(cachedId);
      if (hit && Date.now() - hit.at < CACHE_TTL_MS && hit.shop.slug === slug) {
        return hit.shop;
      }
    }

    const shop = await this.prisma.shop.findUnique({ where: { slug } });
    return shop ? this.remember(shop) : null;
  }

  /** Atalho para o fuso da barbearia, usado por todo o motor de agenda. */
  async timezone(shopId: string): Promise<string> {
    return (await this.get(shopId)).timezone;
  }

  async update(shopId: string, data: ShopSettingsUpdate) {
    const shop = await this.prisma.shop.update({
      where: { id: shopId },
      data,
    });
    return this.remember(shop);
  }

  /** Descarta o cache de uma barbearia alterada fora deste serviço. */
  forget(shopId: string) {
    const hit = this.byId.get(shopId);
    if (hit) this.idBySlug.delete(hit.shop.slug);
    this.byId.delete(shopId);
  }

  /** Recorte público: o que a landing page pode mostrar sem autenticação. */
  async publicInfo(shopId: string) {
    const s = await this.get(shopId);
    return {
      slug: s.slug,
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

  private remember(shop: Shop): Shop {
    const previous = this.byId.get(shop.id);
    if (previous && previous.shop.slug !== shop.slug) {
      this.idBySlug.delete(previous.shop.slug);
    }
    this.byId.set(shop.id, { shop, at: Date.now() });
    this.idBySlug.set(shop.slug, shop.id);
    return shop;
  }
}
