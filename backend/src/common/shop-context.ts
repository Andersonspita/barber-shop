import {
  BadRequestException,
  ExecutionContext,
  Injectable,
  NestMiddleware,
  NotFoundException,
  createParamDecorator,
} from '@nestjs/common';
import { Shop } from '@prisma/client';
import type { NextFunction, Request, Response } from 'express';
import { ShopSettingsService } from '../shop/shop-settings.service';

/** Cabeçalho com o slug da barbearia, enviado pelo frontend em toda chamada. */
export const SHOP_HEADER = 'x-shop';

export interface ShopRequest extends Request {
  shop?: Shop;
  /** `header` quando o cliente disse a barbearia; `default` quando veio do .env. */
  shopSource?: 'header' | 'default';
  user?: { shopId: string };
}

/**
 * Descobre de qual barbearia é a requisição.
 *
 * Rotas públicas (vitrine, horários, login, cadastro) não têm sessão, então a
 * barbearia vem do cabeçalho `X-Shop`. Sem ele, vale `DEFAULT_SHOP_SLUG` —
 * o que mantém funcionando uma instalação de barbearia única e clientes
 * antigos que ainda não mandam o cabeçalho.
 *
 * Nas rotas logadas quem manda é a sessão (ver `JwtStrategy`), e este
 * middleware só serve para recusar um token usado na barbearia errada.
 */
@Injectable()
export class ShopResolverMiddleware implements NestMiddleware {
  constructor(private readonly shops: ShopSettingsService) {}

  async use(req: ShopRequest, _res: Response, next: NextFunction) {
    try {
      const header = req.headers[SHOP_HEADER];
      const fromHeader = (Array.isArray(header) ? header[0] : header)
        ?.trim()
        .toLowerCase();
      const slug = fromHeader || process.env.DEFAULT_SHOP_SLUG?.trim();

      if (slug) {
        const shop = await this.shops.findBySlug(slug);
        if (!shop || !shop.isActive) {
          // Só o cabeçalho explícito é erro do cliente. Um DEFAULT_SHOP_SLUG
          // inválido não pode derrubar as rotas que nem precisam de barbearia.
          if (fromHeader) {
            throw new NotFoundException('Barbearia não encontrada.');
          }
        } else {
          req.shop = shop;
          req.shopSource = fromHeader ? 'header' : 'default';
        }
      }
      next();
    } catch (error) {
      next(error);
    }
  }
}

/**
 * Id da barbearia da requisição: a da sessão, quando há login, ou a do
 * cabeçalho `X-Shop`. Toda consulta ao banco de dados de uma barbearia recebe
 * este valor — é o que impede uma barbearia de enxergar os dados de outra.
 */
export const ShopId = createParamDecorator(
  (_data: unknown, context: ExecutionContext): string => {
    const req = context.switchToHttp().getRequest<ShopRequest>();
    const shopId = req.user?.shopId ?? req.shop?.id;
    if (!shopId) {
      throw new BadRequestException(
        'Informe a barbearia (cabeçalho X-Shop com o identificador dela).',
      );
    }
    return shopId;
  },
);

// ------------------------------------------------------------------ slugs

const SLUG_PATTERN = /^[a-z0-9](?:[a-z0-9-]{1,38}[a-z0-9])$/;

/**
 * Caminhos que o nginx manda para a API ou que o frontend usa na raiz. Uma
 * barbearia com um destes slugs ficaria com a vitrine inacessível.
 */
const RESERVED_SLUGS = new Set([
  'admin',
  'api',
  'apple-icon',
  'appointments',
  'auth',
  'barbers',
  'dashboard',
  'icon',
  'login',
  'plataforma',
  'platform',
  'reservas',
  'schedule-blocks',
  'services',
  'shop',
  'shops',
  'waitlist',
]);

export function assertValidSlug(slug: string): string {
  const normalized = slug.trim().toLowerCase();
  if (!SLUG_PATTERN.test(normalized)) {
    throw new BadRequestException(
      'O endereço precisa ter de 3 a 40 caracteres: letras minúsculas, números e hífen, sem hífen nas pontas.',
    );
  }
  if (RESERVED_SLUGS.has(normalized)) {
    throw new BadRequestException(
      `"${normalized}" é um endereço reservado do sistema. Escolha outro.`,
    );
  }
  return normalized;
}
