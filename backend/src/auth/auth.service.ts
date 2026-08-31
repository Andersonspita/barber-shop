import {
  BadRequestException,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { createHash, randomBytes } from 'node:crypto';
import { addMinutes } from 'date-fns';
import { User } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { WhatsappClient } from '../notifications/whatsapp.client';

const SALT_ROUNDS = 10;
const RESET_TOKEN_TTL_MINUTES = 30;

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);
  private readonly appUrl = (
    process.env.APP_URL ?? 'http://localhost:3000'
  ).replace(/\/+$/, '');

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly whatsapp: WhatsappClient,
  ) {}

  async login(email: string, pass: string) {
    const user = await this.prisma.user.findUnique({ where: { email } });

    // A comparação roda mesmo sem usuário para não vazar, pelo tempo de
    // resposta, quais e-mails existem na base.
    const hash = user?.passwordHash ?? DUMMY_HASH;
    const matches = await bcrypt.compare(pass, hash);

    if (!user || !matches) {
      throw new UnauthorizedException('E-mail ou senha incorretos.');
    }
    if (!user.isActive) {
      throw new UnauthorizedException(
        'Esta conta está desativada. Fale com a barbearia.',
      );
    }

    return this.session(user);
  }

  async signup(input: {
    name: string;
    email: string;
    pass: string;
    phoneNumber: string;
    birthDate?: string;
  }) {
    const exists = await this.prisma.user.findUnique({
      where: { email: input.email },
    });
    if (exists) {
      throw new BadRequestException('Este e-mail já está cadastrado.');
    }

    const user = await this.prisma.user.create({
      data: {
        name: input.name.trim(),
        email: input.email,
        passwordHash: await bcrypt.hash(input.pass, SALT_ROUNDS),
        phoneNumber: input.phoneNumber.trim(),
        birthDate: parseBirthDate(input.birthDate),
        role: 'CLIENT',
      },
    });

    return this.session(user);
  }

  async changePassword(userId: string, currentPass: string, newPass: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user || !(await bcrypt.compare(currentPass, user.passwordHash))) {
      throw new UnauthorizedException('Senha atual incorreta.');
    }
    if (await bcrypt.compare(newPass, user.passwordHash)) {
      throw new BadRequestException(
        'A nova senha precisa ser diferente da atual.',
      );
    }

    await this.prisma.user.update({
      where: { id: userId },
      data: {
        passwordHash: await bcrypt.hash(newPass, SALT_ROUNDS),
        mustChangePassword: false,
      },
    });

    return { message: 'Senha alterada com sucesso.' };
  }

  /**
   * Gera o token e o entrega pelo WhatsApp do cliente. A resposta é sempre a
   * mesma, exista o e-mail ou não — caso contrário a rota vira um verificador
   * de quais clientes a barbearia tem.
   */
  async requestPasswordReset(email: string) {
    const genericResponse = {
      message:
        'Se este e-mail estiver cadastrado, enviaremos um link de recuperação por WhatsApp.',
    };

    const user = await this.prisma.user.findUnique({ where: { email } });
    if (!user || !user.isActive) return genericResponse;

    const token = randomBytes(32).toString('hex');

    await this.prisma.passwordResetToken.create({
      data: {
        userId: user.id,
        tokenHash: hashToken(token),
        expiresAt: addMinutes(new Date(), RESET_TOKEN_TTL_MINUTES),
      },
    });

    const link = `${this.appUrl}/login/recuperar?token=${token}`;

    if (user.phoneNumber) {
      await this.whatsapp
        .sendText(
          user.phoneNumber,
          `Recebemos um pedido para redefinir sua senha.\n\n` +
            `Abra este link em até ${RESET_TOKEN_TTL_MINUTES} minutos:\n${link}\n\n` +
            `Se não foi você, ignore esta mensagem.`,
        )
        .catch((error: unknown) => {
          this.logger.error(`Falha ao enviar recuperação: ${String(error)}`);
        });
    } else {
      this.logger.warn(
        `Usuário ${user.email} pediu recuperação de senha mas não tem telefone cadastrado. Link: ${link}`,
      );
    }

    return genericResponse;
  }

  async resetPassword(token: string, newPass: string) {
    const record = await this.prisma.passwordResetToken.findUnique({
      where: { tokenHash: hashToken(token) },
      include: { user: true },
    });

    if (!record || record.usedAt || record.expiresAt < new Date()) {
      throw new BadRequestException(
        'Este link de recuperação expirou ou já foi usado. Peça um novo.',
      );
    }

    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: record.userId },
        data: {
          passwordHash: await bcrypt.hash(newPass, SALT_ROUNDS),
          mustChangePassword: false,
        },
      }),
      this.prisma.passwordResetToken.update({
        where: { id: record.id },
        data: { usedAt: new Date() },
      }),
      // Qualquer outro pedido pendente perde a validade junto.
      this.prisma.passwordResetToken.deleteMany({
        where: { userId: record.userId, usedAt: null },
      }),
    ]);

    return { message: 'Senha redefinida. Faça login com a nova senha.' };
  }

  async me(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        name: true,
        email: true,
        phoneNumber: true,
        birthDate: true,
        role: true,
        isAdmin: true,
        photoUrl: true,
        mustChangePassword: true,
      },
    });
    if (!user) throw new UnauthorizedException();
    return user;
  }

  async updateProfile(
    userId: string,
    data: { name?: string; phoneNumber?: string; birthDate?: string },
  ) {
    return this.prisma.user.update({
      where: { id: userId },
      data: {
        ...(data.name ? { name: data.name.trim() } : {}),
        ...(data.phoneNumber ? { phoneNumber: data.phoneNumber.trim() } : {}),
        ...(data.birthDate !== undefined
          ? { birthDate: parseBirthDate(data.birthDate) }
          : {}),
      },
      select: {
        id: true,
        name: true,
        email: true,
        phoneNumber: true,
        birthDate: true,
        role: true,
        isAdmin: true,
        photoUrl: true,
      },
    });
  }

  private session(user: User) {
    const payload = {
      sub: user.id,
      email: user.email,
      role: user.role,
      isAdmin: user.isAdmin,
    };

    return {
      access_token: this.jwtService.sign(payload),
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        isAdmin: user.isAdmin,
        photoUrl: user.photoUrl,
        mustChangePassword: user.mustChangePassword,
      },
    };
  }
}

function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

function parseBirthDate(value?: string): Date | null {
  if (!value) return null;
  const date = new Date(`${value.slice(0, 10)}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime())) {
    throw new BadRequestException('Data de nascimento inválida.');
  }
  return date;
}

/** Hash descartável de custo equivalente, usado só para igualar o tempo do login. */
const DUMMY_HASH = '$2b$10$CwTycUXWue0Thq9StjUM0uJ8.z3rEO4Vv4LhVeaKWEV0YXKPKPvhu';
