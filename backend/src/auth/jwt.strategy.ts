import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { PrismaService } from '../prisma/prisma.service';
import { requireJwtSecret } from './jwt-secret.util';
import { SessionUser } from '../appointments/appointments.service';
import type { ShopRequest } from '../common/shop-context';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(private readonly prisma: PrismaService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: requireJwtSecret(),
      passReqToCallback: true,
    });
  }

  /**
   * O papel e a barbearia vêm do banco, não do token: promover, desativar ou
   * suspender passa a valer na requisição seguinte, sem esperar o JWT expirar.
   */
  async validate(
    req: ShopRequest,
    payload: { sub: string },
  ): Promise<SessionUser> {
    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
      select: {
        id: true,
        shopId: true,
        email: true,
        name: true,
        role: true,
        isAdmin: true,
        isActive: true,
        shop: { select: { isActive: true } },
      },
    });

    if (!user || !user.isActive) {
      throw new UnauthorizedException();
    }
    if (!user.shop.isActive) {
      throw new UnauthorizedException(
        'Esta barbearia está com o acesso suspenso.',
      );
    }

    // Token de uma barbearia usado na página de outra. Sem esta checagem a
    // sessão continuaria valendo — só que para os dados da barbearia de
    // origem, com a marca da outra na tela.
    if (
      req.shopSource === 'header' &&
      req.shop &&
      req.shop.id !== user.shopId
    ) {
      throw new UnauthorizedException(
        'Esta sessão pertence a outra barbearia. Entre novamente.',
      );
    }

    return {
      id: user.id,
      shopId: user.shopId,
      email: user.email,
      name: user.name,
      role: user.role,
      isAdmin: user.isAdmin,
    };
  }
}
