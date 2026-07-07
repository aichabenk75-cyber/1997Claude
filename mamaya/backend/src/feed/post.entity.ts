import {
  Column,
  CreateDateColumn,
  DeleteDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToMany,
  OneToOne,
  PrimaryColumn,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { User } from '../users/user.entity';

export enum PostType {
  TEXTE = 'texte',
  PHOTO = 'photo',
  SONDAGE = 'sondage',
}

export enum ModerationState {
  EN_ATTENTE = 'en_attente',
  APPROUVE = 'approuve',
  REJETE = 'rejete',
  REVUE_HUMAINE = 'revue_humaine',
}

@Entity('posts')
export class Post {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column('uuid')
  authorId: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'author_id' })
  author: User;

  @Column({ type: 'enum', enum: PostType, default: PostType.TEXTE })
  type: PostType;

  @Column({ type: 'text', nullable: true })
  body: string | null;

  @Column({ type: 'smallint', nullable: true })
  categoryId: number | null;

  // Calculé à la publication depuis le profil de l'autrice (ex. 'bebe_0_3m') —
  // jamais la date de terme ou de naissance exacte.
  @Column({ type: 'text', nullable: true })
  audienceStage: string | null;

  // Un post reste invisible du feed public tant qu'il n'est pas 'approuve'
  // (l'autrice, elle, le voit immédiatement).
  @Column({ type: 'enum', enum: ModerationState, default: ModerationState.EN_ATTENTE })
  moderation: ModerationState;

  @Column({ type: 'integer', default: 0 })
  likeCount: number;

  @Column({ type: 'integer', default: 0 })
  commentCount: number;

  @Column({ type: 'integer', default: 0 })
  shareCount: number;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @DeleteDateColumn({ type: 'timestamptz' })
  deletedAt: Date | null;

  @OneToMany(() => PostMedia, (m) => m.post, { cascade: true })
  media: PostMedia[];

  @OneToOne(() => Poll, (p) => p.post, { cascade: true })
  poll: Poll | null;
}

@Entity('post_media')
export class PostMedia {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column('uuid')
  postId: string;

  @ManyToOne(() => Post, (p) => p.media, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'post_id' })
  post: Post;

  // Objet S3 privé — servi via URL signée/CDN, jamais d'URL publique brute.
  @Column({ type: 'text' })
  s3Key: string;

  @Column({ type: 'int', nullable: true })
  width: number | null;

  @Column({ type: 'int', nullable: true })
  height: number | null;

  @Column({ type: 'smallint', default: 0 })
  position: number;
}

@Entity('polls')
export class Poll {
  @PrimaryColumn('uuid')
  postId: string;

  @OneToOne(() => Post, (p) => p.poll, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'post_id' })
  post: Post;

  @Column({ type: 'timestamptz', nullable: true })
  closesAt: Date | null;

  @OneToMany(() => PollOption, (o) => o.poll, { cascade: true })
  options: PollOption[];
}

@Entity('poll_options')
export class PollOption {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column('uuid')
  postId: string;

  @ManyToOne(() => Poll, (p) => p.options, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'post_id' })
  poll: Poll;

  @Column({ type: 'text' })
  label: string;

  @Column({ type: 'smallint' })
  position: number;
}
