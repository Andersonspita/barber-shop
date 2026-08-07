import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
  ) {}

  async login(email: string, pass: string) {
    const user = await this.prisma.user.findUnique({ where: { email } });
    
    // Comparação simples para fins de MVP (use bcrypt num ambiente real completo)
    if (!user || user.passwordHash !== pass) {
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
        passwordHash: pass,
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
    if (!user || user.passwordHash !== currentPass) {
      throw new UnauthorizedException('Senha atual incorreta.');
    }

    await this.prisma.user.update({
      where: { email },
      data: { passwordHash: newPass }
    });

    return { message: 'Senha alterada com sucesso.' };
  }
}
