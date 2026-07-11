import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  NotFoundException,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import { IsIn, IsString, MaxLength } from 'class-validator';
import {
  AuthenticatedUser,
  CurrentUser,
  JwtAuthGuard,
} from '../auth/guards/jwt-auth.guard';
import { UsersService } from './users.service';

// Consentements que l'app peut accorder/révoquer après l'inscription.
// ('cgu' et 'sante' sont recueillis à l'inscription, pas modifiables ici.)
const CONSENT_KINDS = ['geoloc', 'notifications'] as const;

class GrantConsentDto {
  @IsIn([...CONSENT_KINDS])
  kind: (typeof CONSENT_KINDS)[number];

  @IsString()
  @MaxLength(20)
  version: string;
}

/** Routes « moi » : profil + gestion des consentements RGPD. */
@Controller({ path: 'me', version: '1' })
@UseGuards(JwtAuthGuard)
export class MeController {
  constructor(private readonly users: UsersService) {}

  @Get()
  async me(@CurrentUser() user: AuthenticatedUser) {
    const profile = await this.users.getProfile(user.id);
    if (!profile) throw new NotFoundException();
    return profile;
  }

  @Post('consents')
  @HttpCode(204)
  grant(@CurrentUser() user: AuthenticatedUser, @Body() dto: GrantConsentDto) {
    return this.users.grantConsent(user.id, dto.kind, dto.version);
  }

  @Delete('consents/:kind')
  @HttpCode(204)
  revoke(@CurrentUser() user: AuthenticatedUser, @Param('kind') kind: string) {
    if (!(CONSENT_KINDS as readonly string[]).includes(kind)) {
      throw new NotFoundException();
    }
    return this.users.revokeConsent(user.id, kind);
  }
}
