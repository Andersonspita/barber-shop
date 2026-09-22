import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { createHash, timingSafeEqual } from 'node:crypto';

export const PLATFORM_KEY_HEADER = 'x-platform-key';

/**
 * Acesso de quem opera a plataforma — acima do admin de cada barbearia.
 *
 * É uma chave no .env, não um usuário: toda conta pertence a uma barbearia, e
 * dar a um admin de barbearia o poder de criar ou suspender outras seria
 * exatamente o vazamento que o multi-tenant existe para impedir. Sem
 * `PLATFORM_ADMIN_KEY` configurada, as rotas nem aparecem (404).
 */
@Injectable()
export class PlatformGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const expected = process.env.PLATFORM_ADMIN_KEY?.trim();
    if (!expected) throw new NotFoundException();

    const req = context.switchToHttp().getRequest<{
      headers: Record<string, string | string[] | undefined>;
    }>();
    const header = req.headers[PLATFORM_KEY_HEADER];
    const provided = (Array.isArray(header) ? header[0] : header) ?? '';

    // Compara os hashes para ter tamanho fixo e tempo constante.
    const matches = timingSafeEqual(digest(provided), digest(expected));
    if (!matches) {
      throw new ForbiddenException('Chave da plataforma inválida.');
    }
    return true;
  }
}

function digest(value: string): Buffer {
  return createHash('sha256').update(value).digest();
}
