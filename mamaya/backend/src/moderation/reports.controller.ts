import {
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { IsEnum, IsIn, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';
import { DataSource } from 'typeorm';
import {
  AuthenticatedUser,
  CurrentUser,
  JwtAuthGuard,
} from '../auth/guards/jwt-auth.guard';

class CreateReportDto {
  @IsEnum(['post', 'comment', 'user', 'message'] as const)
  targetType: 'post' | 'comment' | 'user' | 'message';

  @IsUUID()
  targetId: string;

  @IsIn(['harcelement', 'spam', 'contenu_inapproprie', 'danger_enfant', 'autre'])
  reason: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  details?: string;
}

class ModDecisionDto {
  @IsEnum(['post', 'comment', 'user', 'message'] as const)
  targetType: 'post' | 'comment' | 'user' | 'message';

  @IsUUID()
  targetId: string;

  @IsIn(['approuve', 'rejete', 'avertissement', 'ban_7j', 'ban_definitif'])
  action: string;

  @IsString()
  @MaxLength(500)
  reason: string;
}

@Controller({ version: '1' })
@UseGuards(JwtAuthGuard)
export class ReportsController {
  constructor(private readonly dataSource: DataSource) {}

  /** Bouton de signalement rapide — présent sur chaque post/commentaire/profil/message. */
  @Post('reports')
  @Throttle({ default: { limit: 20, ttl: 86_400_000 } }) // 20/jour
  async report(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateReportDto) {
    const [row] = await this.dataSource.query(
      `INSERT INTO reports (reporter_id, target_type, target_id, reason, details)
       VALUES ($1, $2, $3, $4, $5) RETURNING id`,
      [user.id, dto.targetType, dto.targetId, dto.reason, dto.details ?? null],
    );
    return { id: row.id, status: 'ouvert' };
  }

  @Post('users/:id/block')
  @HttpCode(204)
  async block(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) blockedId: string,
  ) {
    if (blockedId === user.id) throw new ForbiddenException();
    await this.dataSource.query(
      `INSERT INTO user_blocks (blocker_id, blocked_id) VALUES ($1, $2)
       ON CONFLICT DO NOTHING`,
      [user.id, blockedId],
    );
  }

  @Delete('users/:id/block')
  @HttpCode(204)
  async unblock(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) blockedId: string,
  ) {
    await this.dataSource.query(
      `DELETE FROM user_blocks WHERE blocker_id = $1 AND blocked_id = $2`,
      [user.id, blockedId],
    );
  }

  // ---- Back-office (rôle moderator/admin) ----------------------------------

  @Get('mod/queue')
  async queue(@CurrentUser() user: AuthenticatedUser, @Query('cursor') cursor?: string) {
    this.assertModerator(user);
    const reports = await this.dataSource.query(
      `SELECT r.*, p.display_name AS reporter_name
       FROM reports r
       JOIN user_profiles p ON p.user_id = r.reporter_id
       WHERE r.status = 'ouvert'
         AND ($1::timestamptz IS NULL OR r.created_at > $1)
       ORDER BY r.created_at
       LIMIT 50`,
      [cursor ?? null],
    );
    const pending = await this.dataSource.query(
      `SELECT 'post' AS target_type, id, body, created_at FROM posts
        WHERE moderation = 'revue_humaine' AND deleted_at IS NULL
       UNION ALL
       SELECT 'comment', id, body, created_at FROM comments
        WHERE moderation = 'revue_humaine' AND deleted_at IS NULL
       ORDER BY created_at LIMIT 50`,
    );
    return { reports, pendingReview: pending };
  }

  @Post('mod/decisions')
  async decide(@CurrentUser() user: AuthenticatedUser, @Body() dto: ModDecisionDto) {
    this.assertModerator(user);
    await this.dataSource.transaction(async (em) => {
      // Trace systématique — qui a décidé quoi, quand, pourquoi (audit)
      await em.query(
        `INSERT INTO moderation_actions (target_type, target_id, actor, action, reason)
         VALUES ($1, $2, $3, $4, $5)`,
        [dto.targetType, dto.targetId, user.id, dto.action, dto.reason],
      );
      if (dto.targetType === 'post' || dto.targetType === 'comment') {
        const table = dto.targetType === 'post' ? 'posts' : 'comments';
        if (dto.action === 'approuve' || dto.action === 'rejete') {
          await em.query(`UPDATE ${table} SET moderation = $2 WHERE id = $1`, [
            dto.targetId,
            dto.action,
          ]);
        }
      }
      await em.query(
        `UPDATE reports SET status = 'traite', handled_by = $2, handled_at = now()
         WHERE target_type = $3 AND target_id = $1 AND status = 'ouvert'`,
        [dto.targetId, user.id, dto.targetType],
      );
    });
    return { ok: true };
  }

  private assertModerator(user: AuthenticatedUser): void {
    if (user.role !== 'moderator' && user.role !== 'admin') {
      throw new ForbiddenException({ code: 'mod/forbidden' });
    }
  }
}
