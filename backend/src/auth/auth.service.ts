import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../prisma/prisma.service';

const SALT_ROUNDS = 10;

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
  ) {}

  async login(email: string, pass: string) {
    const user = await this.prisma.user.findUnique({ where: { email } });

    if (!user || !(await bcrypt.compare(pass, user.passwordHash))) {
      throw new UnauthorizedException('Credenciais inválidas');
    }

    const payload = { sub: user.id, email: user.email, role: user.role, isAdmin: user.isAdmin };
    
    return {
      access_token: this.jwtService.sign(payload),
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        isAdmin: user.isAdmin,
      }
    };
  }

  async signup(name: string, email: string, pass: string, birthDate?: string) {
    const exists = await this.prisma.user.findUnique({ where: { email } });
    if (exists) throw new UnauthorizedException('E-mail já está em uso.');

    const user = await this.prisma.user.create({
      data: {
        name,
        email,
        passwordHash: await bcrypt.hash(pass, SALT_ROUNDS),
        birthDate: birthDate ? new Date(birthDate) : null,
        role: 'CLIENT',
      },
    });

    const payload = { sub: user.id, email: user.email, role: user.role, isAdmin: user.isAdmin };
    
    return {
      access_token: this.jwtService.sign(payload),
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        isAdmin: user.isAdmin,
      }
    };
  }

  async changePassword(email: string, currentPass: string, newPass: string) {
    const user = await this.prisma.user.findUnique({ where: { email } });
    if (!user || !(await bcrypt.compare(currentPass, user.passwordHash))) {
      throw new UnauthorizedException('Senha atual incorreta.');
    }

    await this.prisma.user.update({
      where: { email },
      data: { passwordHash: await bcrypt.hash(newPass, SALT_ROUNDS) }
    });

    return { message: 'Senha alterada com sucesso.' };
  }
}
