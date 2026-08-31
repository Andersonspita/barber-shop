import { Body, Controller, Get, Post, Put, Request } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { AuthService } from './auth.service';
import { Auth } from '../common/roles.guard';
import {
  ChangePasswordDto,
  ForgotPasswordDto,
  LoginDto,
  ResetPasswordDto,
  SignupDto,
  UpdateProfileDto,
} from './dto';
import { SessionUser } from '../appointments/appointments.service';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  /** Limite estreito: é a rota que um ataque de força bruta escolheria. */
  @Throttle({ default: { limit: 8, ttl: 60_000 } })
  @Post('login')
  async login(@Body() body: LoginDto) {
    return this.authService.login(body.email, body.pass);
  }

  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @Post('signup')
  async signup(@Body() body: SignupDto) {
    return this.authService.signup(body);
  }

  @Throttle({ default: { limit: 4, ttl: 300_000 } })
  @Post('forgot-password')
  async forgotPassword(@Body() body: ForgotPasswordDto) {
    return this.authService.requestPasswordReset(body.email);
  }

  @Throttle({ default: { limit: 8, ttl: 300_000 } })
  @Post('reset-password')
  async resetPassword(@Body() body: ResetPasswordDto) {
    return this.authService.resetPassword(body.token, body.newPass);
  }

  @Auth()
  @Post('change-password')
  async changePassword(
    @Body() body: ChangePasswordDto,
    @Request() req: { user: SessionUser },
  ) {
    return this.authService.changePassword(
      req.user.id,
      body.currentPass,
      body.newPass,
    );
  }

  @Auth()
  @Get('me')
  async me(@Request() req: { user: SessionUser }) {
    return this.authService.me(req.user.id);
  }

  @Auth()
  @Put('me')
  async updateProfile(
    @Body() body: UpdateProfileDto,
    @Request() req: { user: SessionUser },
  ) {
    return this.authService.updateProfile(req.user.id, body);
  }
}
