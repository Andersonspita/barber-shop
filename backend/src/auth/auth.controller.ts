import { Controller, Post, Body, UseGuards, Request } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { AuthService } from './auth.service';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('login')
  async login(@Body() body: { email: string; pass: string }) {
    return this.authService.login(body.email, body.pass);
  }

  @Post('signup')
  async signup(@Body() body: { name: string; email: string; pass: string; birthDate?: string }) {
    return this.authService.signup(body.name, body.email, body.pass, body.birthDate);
  }

  @UseGuards(AuthGuard('jwt'))
  @Post('change-password')
  async changePassword(@Body() body: { currentPass: string; newPass: string }, @Request() req: any) {
    return this.authService.changePassword(req.user.email, body.currentPass, body.newPass);
  }
}
