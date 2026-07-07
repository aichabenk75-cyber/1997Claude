import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { DataSource } from 'typeorm';
import { CreateCommentDto, CreatePostDto } from './dto/create-post.dto';
import { ModerationState, Poll, PollOption, Post, PostMedia, PostType } from './post.entity';
import { Comment, Reaction, ReactionTarget } from './comment.entity';

@Injectable()
export class PostsService {
  constructor(
    private readonly dataSource: DataSource,
    // Chaque contenu créé part en modération asynchrone (blocklist → IA).
    @InjectQueue('moderation') private readonly moderationQueue: Queue,
  ) {}

  async createPost(authorId: string, dto: CreatePostDto): Promise<Post> {
    const post = await this.dataSource.transaction(async (em) => {
      const created = em.create(Post, {
        authorId,
        type: dto.type,
        body: dto.body ?? null,
        categoryId: dto.categoryId ?? null,
        audienceStage: await this.computeAudienceStage(authorId),
        moderation: ModerationState.EN_ATTENTE,
      });
      await em.save(created);

      if (dto.type === PostType.PHOTO && dto.mediaKeys) {
        await em.save(
          dto.mediaKeys.map((s3Key, position) =>
            em.create(PostMedia, { postId: created.id, s3Key, position }),
          ),
        );
      }

      if (dto.type === PostType.SONDAGE && dto.poll) {
        await em.save(em.create(Poll, {
          postId: created.id,
          closesAt: dto.poll.closesAt ? new Date(dto.poll.closesAt) : null,
        }));
        await em.save(
          dto.poll.options.map((label, position) =>
            em.create(PollOption, { postId: created.id, label, position }),
          ),
        );
      }
      return created;
    });

    await this.moderationQueue.add('classify', {
      targetType: 'post',
      targetId: post.id,
    });
    return post;
  }

  async addComment(authorId: string, postId: string, dto: CreateCommentDto): Promise<Comment> {
    const post = await this.dataSource.getRepository(Post).findOneBy({ id: postId });
    if (!post || post.deletedAt) throw new NotFoundException();

    const comment = await this.dataSource.getRepository(Comment).save(
      this.dataSource.getRepository(Comment).create({
        authorId,
        postId,
        parentId: dto.parentId ?? null,
        body: dto.body,
      }),
    );

    await this.moderationQueue.add('classify', {
      targetType: 'comment',
      targetId: comment.id,
    });
    return comment;
  }

  /** « Soutien » idempotent : PUT ajoute, DELETE retire ; compteur bufferisé. */
  async setReaction(
    userId: string,
    targetType: ReactionTarget,
    targetId: string,
    active: boolean,
  ): Promise<void> {
    const repo = this.dataSource.getRepository(Reaction);
    if (active) {
      await repo.upsert({ userId, targetType, targetId }, ['userId', 'targetType', 'targetId']);
    } else {
      await repo.delete({ userId, targetType, targetId });
    }
    // Compteur dénormalisé — incrément atomique, pas de COUNT(*)
    if (targetType === ReactionTarget.POST) {
      await this.dataSource.query(
        `UPDATE posts SET like_count = (SELECT count(*) FROM reactions
          WHERE target_type = 'post' AND target_id = $1) WHERE id = $1`,
        [targetId],
      );
    }
  }

  async votePoll(userId: string, postId: string, optionId: string): Promise<void> {
    const poll = await this.dataSource.getRepository(Poll).findOneBy({ postId });
    if (!poll) throw new NotFoundException();
    if (poll.closesAt && poll.closesAt < new Date()) {
      throw new ForbiddenException({ code: 'poll/closed' });
    }
    // 1 voix par sondage : on remplace un éventuel vote précédent
    await this.dataSource.transaction(async (em) => {
      await em.query(
        `DELETE FROM poll_votes v USING poll_options o
         WHERE v.option_id = o.id AND o.post_id = $1 AND v.user_id = $2`,
        [postId, userId],
      );
      await em.query(
        `INSERT INTO poll_votes (option_id, user_id) VALUES ($1, $2)`,
        [optionId, userId],
      );
    });
  }

  async deletePost(userId: string, postId: string, isModerator: boolean): Promise<void> {
    const post = await this.dataSource.getRepository(Post).findOneBy({ id: postId });
    if (!post) throw new NotFoundException();
    if (post.authorId !== userId && !isModerator) throw new ForbiddenException();
    await this.dataSource.getRepository(Post).softDelete(postId);
  }

  /**
   * Stade d'audience de l'autrice, en granularité grossière uniquement
   * (trimestre / tranche d'âge du plus jeune enfant) — cf. Étape 4.
   */
  private async computeAudienceStage(userId: string): Promise<string | null> {
    const [row] = await this.dataSource.query(
      `SELECT u.status, u.due_date,
              (SELECT min(c.birth_month) FROM children c WHERE c.user_id = u.id) AS eldest,
              (SELECT max(c.birth_month) FROM children c WHERE c.user_id = u.id) AS youngest
       FROM users u WHERE u.id = $1`,
      [userId],
    );
    if (!row) return null;
    if (row.status === 'enceinte' && row.due_date) {
      const weeksLeft = (new Date(row.due_date).getTime() - Date.now()) / (7 * 86400e3);
      const weeksIn = 40 - Math.max(0, weeksLeft);
      return weeksIn < 14 ? 'grossesse_t1' : weeksIn < 28 ? 'grossesse_t2' : 'grossesse_t3';
    }
    if (row.youngest) {
      const months =
        (Date.now() - new Date(row.youngest).getTime()) / (30.44 * 86400e3);
      if (months < 3) return 'bebe_0_3m';
      if (months < 12) return 'bebe_3_12m';
      if (months < 36) return 'enfant_1_3a';
      return 'enfant_3a_plus';
    }
    return null;
  }
}
