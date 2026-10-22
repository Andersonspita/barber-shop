import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { createHash, timingSafeEqual } from 'node:crypto';

export const PROVISIONING_KEY_HEADER = 'x-provisioning-key';

/**
 * Acesso do SDR-AI ao provisionamento de testes grátis.
 *
 * É uma chave separada da `PLATFORM_ADMIN_KEY` de propósito: o SDR só
 * consegue criar barbearias em teste, nunca suspender, renomear ou listar as
 * outras. Sem `PROVISIONING_API_KEY` configurada, a rota responde 404.
 */
@Injectable()
export class ProvisioningGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const expected = process.env.PROVISIONING_API_KEY?.trim();
    if (!expected) throw new NotFoundException();

    const req = context.switchToHttp().getRequest<{
      headers: Record<string, string | string[] | undefined>;
    }>();
    const header = req.headers[PROVISIONING_KEY_HEADER];
    const provided = (Array.isArray(header) ? header[0] : header) ?? '';

    if (!timingSafeEqual(digest(provided), digest(expected))) {
      throw new ForbiddenException('Chave de provisionamento inválida.');
    }
    return true;
  }
}

function digest(value: string): Buffer {
  return createHash('sha256').update(value).digest();
}
