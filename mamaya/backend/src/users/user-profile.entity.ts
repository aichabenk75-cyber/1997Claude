import {
  Column,
  Entity,
  JoinColumn,
  OneToOne,
  PrimaryColumn,
  UpdateDateColumn,
} from 'typeorm';
import { User } from './user.entity';

@Entity('user_profiles')
export class UserProfile {
  @PrimaryColumn('uuid')
  userId: string;

  @OneToOne(() => User, (u) => u.profile, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;

  // Pseudo public — jamais le nom légal (on ne le collecte pas).
  @Column({ type: 'text' })
  displayName: string;

  @Column({ type: 'text', nullable: true })
  bio: string | null;

  @Column({ type: 'text', nullable: true })
  avatarUrl: string | null;

  // Libellé choisi par l'utilisatrice (« Lyon ») — jamais une adresse.
  @Column({ type: 'text', nullable: true })
  cityLabel: string | null;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;
}
