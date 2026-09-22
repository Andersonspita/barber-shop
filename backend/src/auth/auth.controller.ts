import { Body, Controller, Get, Post, Put, Request } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { AuthService } from './auth.service';
import { Auth } from '../common/roles.guard';
import { ShopId } from '../common/shop-context';
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
  async login(@ShopId() shopId: string, @Body() body: LoginDto) {
    return this.authService.login(shopId, body.email, body.pass);
  }

  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @Post('signup')
  async signup(@ShopId() shopId: string, @Body() body: SignupDto) {
    return this.authService.signup(shopId, body);
  }

  @Throttle({ default: { limit: 4, ttl: 300_000 } })
  @Post('forgot-password')
  async forgotPassword(
    @ShopId() shopId: string,
    @Body() body: ForgotPasswordDto,
  ) {
    return this.authService.requestPasswordReset(shopId, body.email);
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
