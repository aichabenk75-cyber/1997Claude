import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';

/**
 * Refresh tokens opaques, stockés HACHÉS (SHA-256) — un dump de la base
 * ne permet pas de se connecter. `familyId` regroupe la chaîne de rotations
 * d'un même appareil : si un token déjà utilisé est représenté (vol/rejeu),
 * toute la famille est révoquée.
 */
@Entity('refresh_tokens')
export class RefreshToken {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column('uuid')
  userId: string;

  @Index()
  @Column('uuid')
  familyId: string;

  @Column({ type: 'text', unique: true })
  tokenHash: string;

  @Column({ type: 'timestamptz' })
  expiresAt: Date;

  // Rotation : marqué à l'usage ; un token "used" représenté = rejeu.
  @Column({ type: 'timestamptz', nullable: true })
  usedAt: Date | null;

  @Column({ type: 'timestamptz', nullable: true })
  revokedAt: Date | null;

  // Libellé d'appareil choisi côté client (« iPhone de Léa ») — pas d'IP ni
  // d'empreinte : minimisation.
  @Column({ type: 'text', nullable: true })
  deviceLabel: string | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;
}
