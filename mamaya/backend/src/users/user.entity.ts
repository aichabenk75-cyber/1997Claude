import {
  Column,
  CreateDateColumn,
  DeleteDateColumn,
  Entity,
  Index,
  OneToMany,
  OneToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { UserProfile } from './user-profile.entity';
import { Child } from './child.entity';

export enum UserStatus {
  ENCEINTE = 'enceinte',
  MAMAN = 'maman',
  ESSAI_BEBE = 'essai_bebe',
}

export enum AuthProvider {
  EMAIL = 'email',
  GOOGLE = 'google',
  APPLE = 'apple',
}

export enum UserRole {
  MEMBER = 'member',
  MODERATOR = 'moderator',
  ADMIN = 'admin',
}

@Entity('users')
@Index(['provider', 'providerSub'], { unique: true, where: 'provider_sub IS NOT NULL' })
export class User {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  // citext en base : unicité insensible à la casse
  @Column({ type: 'citext', unique: true })
  email: string;

  @Column({ type: 'timestamptz', nullable: true })
  emailVerifiedAt: Date | null;

  // Argon2id — NULL pour les comptes OAuth sans mot de passe.
  // select:false : jamais chargé par défaut, il faut le demander explicitement.
  @Column({ type: 'text', nullable: true, select: false })
  passwordHash: string | null;

  @Column({ type: 'enum', enum: AuthProvider, default: AuthProvider.EMAIL })
  provider: AuthProvider;

  @Column({ type: 'text', nullable: true, select: false })
  providerSub: string | null;

  // Secret TOTP chiffré en enveloppe (P0) — voir EnvelopeCryptoService.
  @Column({ type: 'bytea', nullable: true, select: false })
  totpSecretEnc: Buffer | null;

  @Column({ type: 'boolean', default: false })
  totpEnabled: boolean;

  @Column({ type: 'enum', enum: UserRole, default: UserRole.MEMBER })
  role: UserRole;

  @Column({ type: 'enum', enum: UserStatus })
  status: UserStatus;

  // Donnée de santé (art. 9 RGPD) : consentement explicite requis,
  // jamais exposée telle quelle aux autres utilisatrices (granularité trimestre).
  @Column({ type: 'date', nullable: true })
  dueDate: string | null;

  @Column({ type: 'text', default: 'fr' })
  locale: string;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  // Soft delete = « suppression en un clic » ; purge définitive à J+30.
  @DeleteDateColumn({ type: 'timestamptz' })
  deletedAt: Date | null;

  @OneToOne(() => UserProfile, (p) => p.user, { cascade: true })
  profile: UserProfile;

  @OneToMany(() => Child, (c) => c.user, { cascade: true })
  children: Child[];

  /** Trimestre de grossesse affichable publiquement — jamais la date de terme. */
  get pregnancyTrimester(): 1 | 2 | 3 | null {
    if (this.status !== UserStatus.ENCEINTE || !this.dueDate) return null;
    const weeksLeft = Math.max(
      0,
      (new Date(this.dueDate).getTime() - Date.now()) / (7 * 24 * 3600 * 1000),
    );
    const weeksIn = 40 - weeksLeft;
    if (weeksIn < 14) return 1;
    if (weeksIn < 28) return 2;
    return 3;
  }
}
