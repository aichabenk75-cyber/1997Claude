import {
  IsBoolean,
  IsDateString,
  IsEmail,
  IsEnum,
  IsIn,
  IsOptional,
  IsString,
  Length,
  MaxLength,
} from 'class-validator';
import { UserStatus } from '../../users/user.entity';

export class LoginDto {
  @IsEmail()
  email: string;

  @IsString()
  @Length(1, 128)
  password: string;

  @IsOptional()
  @IsString()
  @MaxLength(60)
  deviceLabel?: string;
}

export class TwoFactorVerifyDto {
  @IsString()
  ticket: string;

  // 6 chiffres TOTP ou 10 hexa (code de secours)
  @IsString()
  @Length(6, 10)
  code: string;
}

export class RefreshDto {
  @IsString()
  refreshToken: string;
}

export class LogoutDto {
  @IsString()
  refreshToken: string;

  @IsOptional()
  @IsBoolean()
  all?: boolean; // true = révoquer toutes les sessions (tous les appareils)
}

export class OAuthLoginDto {
  @IsIn(['google', 'apple'])
  provider: 'google' | 'apple';

  @IsString()
  idToken: string;

  // Champs d'onboarding — requis uniquement à la PREMIÈRE connexion
  // (compte inexistant) ; sinon ignorés.
  @IsOptional()
  @IsString()
  @Length(2, 30)
  displayName?: string;

  @IsOptional()
  @IsEnum(UserStatus)
  status?: UserStatus;

  @IsOptional()
  @IsDateString()
  dueDate?: string;

  @IsOptional()
  @IsString()
  cguVersion?: string;
}

export class TotpConfirmDto {
  @IsString()
  @Length(6, 6)
  code: string;
}

export class TotpDisableDto {
  @IsString()
  @Length(1, 128)
  password: string;
}
