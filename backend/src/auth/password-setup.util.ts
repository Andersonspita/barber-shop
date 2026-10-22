import { createHash, randomBytes } from 'node:crypto';
import { addMinutes } from 'date-fns';
import { PrismaService } from '../prisma/prisma.service';

/** O token vai para o banco só como hash: um vazamento da tabela não abre contas. */
export function hashResetToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

function appUrl(): string {
  return (process.env.APP_URL ?? 'http://localhost:3000').replace(/\/+$/, '');
}

/**
 * Gera um link de uso único para o usuário definir a senha, na página de
 * recuperação da barbearia dele. Serve tanto para "esqueci a senha" (30 min)
 * quanto para o primeiro acesso do dono de uma barbearia em teste (horas).
 */
export async function createPasswordSetupLink(
  prisma: PrismaService,
  userId: string,
  shopSlug: string,
  ttlMinutes: number,
): Promise<string> {
  const token = randomBytes(32).toString('hex');
  await prisma.passwordResetToken.create({
    data: {
      userId,
      tokenHash: hashResetToken(token),
      expiresAt: addMinutes(new Date(), ttlMinutes),
    },
  });
  return `${appUrl()}/${shopSlug}/login/recuperar?token=${token}`;
}
