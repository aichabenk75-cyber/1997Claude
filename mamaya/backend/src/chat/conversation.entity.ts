import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryColumn,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { User } from '../users/user.entity';

export enum ConversationType {
  DM = 'dm',
  GROUPE_PRIVE = 'groupe_prive',
  GROUPE_PUBLIC = 'groupe_public',
}

@Entity('conversations')
export class Conversation {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'enum', enum: ConversationType })
  type: ConversationType;

  // « Mamans de Paris », « Bébés de mai 2026 » — null pour les DM
  @Column({ type: 'text', nullable: true })
  title: string | null;

  @Column({ type: 'text', nullable: true })
  description: string | null;

  @Column({ type: 'text', nullable: true })
  avatarUrl: string | null;

  // DM : hash des 2 user_ids triés → un seul DM possible par paire (idempotent)
  @Column({ type: 'text', nullable: true, unique: true })
  dmKey: string | null;

  @Column({ type: 'uuid', nullable: true })
  createdBy: string | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;
}

@Entity('conversation_members')
export class ConversationMember {
  @PrimaryColumn('uuid')
  conversationId: string;

  @ManyToOne(() => Conversation, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'conversation_id' })
  conversation: Conversation;

  @PrimaryColumn('uuid')
  @Index()
  userId: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column({ type: 'text', default: 'member' })
  role: 'member' | 'admin';

  @CreateDateColumn({ type: 'timestamptz' })
  joinedAt: Date;

  @Column({ type: 'timestamptz', nullable: true })
  lastReadAt: Date | null;

  @Column({ type: 'boolean', default: false })
  muted: boolean;
}

/**
 * Messages : contenu chiffré au repos (enveloppe AES-256-GCM, clé de
 * l'EXPÉDITRICE). Table partitionnée par mois côté SQL — TypeORM la voit
 * comme une table simple, la migration gère les partitions.
 */
@Entity('messages')
export class Message {
  @PrimaryColumn('uuid')
  id: string;

  @Index()
  @Column('uuid')
  conversationId: string;

  @Column('uuid')
  senderId: string;

  @Column({ type: 'bytea' })
  bodyEnc: Buffer;

  @Column({ type: 'text' })
  keyId: string;

  @Column({ type: 'text', nullable: true })
  mediaS3Key: string | null;

  @PrimaryColumn({ type: 'timestamptz', default: () => 'now()' })
  createdAt: Date;

  @Column({ type: 'timestamptz', nullable: true })
  deletedAt: Date | null;
}
