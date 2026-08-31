import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  SetMetadata,
  applyDecorators,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Reflector } from '@nestjs/core';
import { Role } from '@prisma/client';

export const ROLES_KEY = 'roles';
export const ADMIN_KEY = 'adminOnly';

/**
 * Antes, cada rota repetia `if (!req.user.isAdmin) throw new BadRequestException`
 * — o que também devolvia 400 para o que é, na verdade, um 403. A autorização
 * agora fica declarada no decorator e a resposta traz o status correto.
 */
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const handler = context.getHandler();
    const controller = context.getClass();

    const roles = this.reflector.getAllAndOverride<Role[] | undefined>(
      ROLES_KEY,
      [handler, controller],
    );
    const adminOnly = this.reflector.getAllAndOverride<boolean | undefined>(
      ADMIN_KEY,
      [handler, controller],
    );

    const user = context.switchToHttp().getRequest().user;
    if (!user) throw new ForbiddenException('Sessão inválida.');

    if (adminOnly && !user.isAdmin) {
      throw new ForbiddenException(
        'Esta área é restrita aos administradores da barbearia.',
      );
    }

    if (roles?.length && !roles.includes(user.role) && !user.isAdmin) {
      throw new ForbiddenException('Você não tem acesso a esta área.');
    }

    return true;
  }
}

/** Exige sessão válida. */
export const Auth = () => UseGuards(AuthGuard('jwt'));

/** Exige sessão válida e um dos papéis informados (admin sempre passa). */
export const Roles = (...roles: Role[]) =>
  applyDecorators(
    SetMetadata(ROLES_KEY, roles),
    UseGuards(AuthGuard('jwt'), RolesGuard),
  );

/** Exige sessão válida com `isAdmin`. */
export const AdminOnly = () =>
  applyDecorators(
    SetMetadata(ADMIN_KEY, true),
    UseGuards(AuthGuard('jwt'), RolesGuard),
  );
