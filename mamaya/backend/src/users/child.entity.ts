import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { User } from './user.entity';

/**
 * Données P0 : prénom et date de naissance exacte chiffrés en enveloppe.
 * Seul birth_month (mois tronqué) est en clair — il suffit à tout le produit
 * (matching « Bébés de mai 2026 », feed par âge) sans exposer l'enfant.
 */
@Entity('children')
export class Child {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column('uuid')
  userId: string;

  @ManyToOne(() => User, (u) => u.children, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column({ type: 'bytea', nullable: true, select: false })
  firstNameEnc: Buffer | null;

  @Column({ type: 'bytea', nullable: true, select: false })
  birthdateEnc: Buffer | null;

  // Tronquée au 1er du mois — la seule granularité visible du reste du système.
  @Index()
  @Column({ type: 'date' })
  birthMonth: string;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;
}
