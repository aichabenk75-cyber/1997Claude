import {
  Column,
  CreateDateColumn,
  DeleteDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryColumn,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { User } from '../users/user.entity';
import { ModerationState, Post } from './post.entity';

@Entity('comments')
export class Comment {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column('uuid')
  postId: string;

  @ManyToOne(() => Post, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'post_id' })
  post: Post;

  @Column('uuid')
  authorId: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'author_id' })
  author: User;

  // 1 seul niveau de réponse (parent → enfants), pas de fils infinis.
  @Column({ type: 'uuid', nullable: true })
  parentId: string | null;

  @Column({ type: 'text' })
  body: string;

  @Column({ type: 'enum', enum: ModerationState, default: ModerationState.EN_ATTENTE })
  moderation: ModerationState;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @DeleteDateColumn({ type: 'timestamptz' })
  deletedAt: Date | null;
}

export enum ReactionTarget {
  POST = 'post',
  COMMENT = 'comment',
}

// « Soutien » (like bienveillant) — PK composite : 1 réaction par cible et par personne.
@Entity('reactions')
export class Reaction {
  @PrimaryColumn('uuid')
  userId: string;

  @PrimaryColumn({ type: 'enum', enum: ReactionTarget })
  targetType: ReactionTarget;

  @PrimaryColumn('uuid')
  targetId: string;

  @Column({ type: 'text', default: 'soutien' })
  kind: string;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;
}
