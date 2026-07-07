import {
  Body,
  Controller,
  Delete,
  HttpCode,
  Ip,
  Post,
  UseGuards,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { UsersService } from '../users/users.service';
import { RegisterDto } from '../users/dto/register.dto';
import { AuthService } from './auth.service';
import {
  LoginDto,
  LogoutDto,
  OAuthLoginDto,
  RefreshDto,
  TotpConfirmDto,
  TotpDisableDto,
  TwoFactorVerifyDto,
} from './dto/auth.dto';
import { AuthenticatedUser, CurrentUser, JwtAuthGuard } from './guards/jwt-auth.guard';
import { TotpService } from './totp.service';

/**
 * Routes /v1/auth — limites de débit conformes à l'Étape 3.
 * Les réponses d'échec sont volontairement uniformes (anti-énumération).
 */
@Controller({ path: 'auth', version: '1' })
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly users: UsersService,
    private readonly totp: TotpService,
  ) {}

  @Post('register')
  @Throttle({ default: { limit: 5, ttl: 3600_000 } }) // 5/h/IP
  async register(@Body() dto: RegisterDto) {
    const user = await this.users.register(dto);
    // L'email de vérification part en job async (BullMQ) — réponse minimale.
    return { id: user.id };
  }

  @Post('login')
  @HttpCode(200)
  @Throttle({ default: { limit: 10, ttl: 900_000 } }) // 10/15 min/IP
  login(@Body() dto: LoginDto, @Ip() ip: string) {
    return this.auth.login(dto.email, dto.password, ip, dto.deviceLabel);
  }

  @Post('2fa/verify')
  @HttpCode(200)
  @Throttle({ default: { limit: 5, ttl: 300_000 } }) // 5/5 min
  verify2fa(@Body() dto: TwoFactorVerifyDto) {
    return this.auth.verifyTwoFactor(dto.ticket, dto.code);
  }

  @Post('oauth/google')
  @HttpCode(200)
  oauthGoogle(@Body() dto: Omit<OAuthLoginDto, 'provider'>) {
    return this.auth.oauthLogin({ ...dto, provider: 'google' } as OAuthLoginDto);
  }

  @Post('oauth/apple')
  @HttpCode(200)
  oauthApple(@Body() dto: Omit<OAuthLoginDto, 'provider'>) {
    return this.auth.oauthLogin({ ...dto, provider: 'apple' } as OAuthLoginDto);
  }

  @Post('refresh')
  @HttpCode(200)
  refresh(@Body() dto: RefreshDto) {
    return this.auth.refresh(dto.refreshToken);
  }

  @Post('logout')
  @HttpCode(204)
  @UseGuards(JwtAuthGuard)
  async logout(@CurrentUser() user: AuthenticatedUser, @Body() dto: LogoutDto) {
    await this.auth.logout(user.id, dto.refreshToken, dto.all);
  }

  // ---- 2FA (activation/désactivation, utilisatrice connectée) --------------

  @Post('2fa/enable')
  @UseGuards(JwtAuthGuard)
  async enable2fa(@CurrentUser() user: AuthenticatedUser) {
    const account = await this.users.findById(user.id);
    return this.totp.startEnrollment(user.id, account!.email);
  }

  @Post('2fa/confirm')
  @HttpCode(204)
  @UseGuards(JwtAuthGuard)
  async confirm2fa(@CurrentUser() user: AuthenticatedUser, @Body() dto: TotpConfirmDto) {
    await this.totp.confirmEnrollment(user.id, dto.code);
  }

  @Delete('2fa')
  @HttpCode(204)
  @UseGuards(JwtAuthGuard)
  async disable2fa(@CurrentUser() user: AuthenticatedUser, @Body() dto: TotpDisableDto) {
    // Revalidation du mot de passe avant de retirer un facteur de sécurité.
    const account = await this.users.findById(user.id);
    await this.users.verifyCredentials(account!.email, dto.password);
    await this.totp.disable(user.id);
  }
}
