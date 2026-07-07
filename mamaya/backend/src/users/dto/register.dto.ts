import {
  IsDateString,
  IsEmail,
  IsEnum,
  IsOptional,
  IsString,
  Length,
  Matches,
  MaxLength,
  ValidateIf,
} from 'class-validator';
import { UserStatus } from '../user.entity';

export class RegisterDto {
  @IsEmail()
  @MaxLength(254)
  email: string;

  // 12+ caractères ; la robustesse réelle vient d'Argon2id + rate limiting,
  // pas de règles de composition arbitraires (recommandations NIST/ANSSI).
  @IsString()
  @Length(12, 128)
  password: string;

  @IsString()
  @Length(2, 30)
  @Matches(/^[\p{L}\p{N} _.'-]+$/u, { message: 'Pseudo invalide' })
  displayName: string;

  @IsEnum(UserStatus)
  status: UserStatus;

  // Requise si enceinte — donnée de santé : le consentement art. 9 est
  // recueilli par une case dédiée (consentHealthData) et tracé en base.
  @ValidateIf((o) => o.status === UserStatus.ENCEINTE)
  @IsDateString()
  dueDate?: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  cityLabel?: string;

  /** Version des CGU acceptées (obligatoire, tracée dans consents). */
  @IsString()
  cguVersion: string;

  /** Opt-in explicite pour le traitement des données de santé (art. 9). */
  @ValidateIf((o) => o.status === UserStatus.ENCEINTE || o.dueDate)
  @IsString()
  consentHealthDataVersion?: string;
}
