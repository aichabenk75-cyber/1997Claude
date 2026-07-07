import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import {
  IsEnum,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  MaxLength,
  ValidateIf,
} from 'class-validator';
import { DataSource } from 'typeorm';
import {
  AuthenticatedUser,
  CurrentUser,
  JwtAuthGuard,
} from '../auth/guards/jwt-auth.guard';
import { ChatService } from './chat.service';
import { ConversationType } from './conversation.entity';

class CreateConversationDto {
  @IsEnum(ConversationType)
  type: ConversationType;

  // DM : l'autre maman
  @ValidateIf((o) => o.type === ConversationType.DM)
  @IsUUID()
  userId?: string;

  // Groupes : titre requis
  @ValidateIf((o) => o.type !== ConversationType.DM)
  @IsString()
  @Length(3, 80)
  title?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;
}

class SendMessageRestDto {
  @IsString()
  @Length(1, 4000)
  body: string;
}

/** REST du chat : historique et gestion — le temps réel passe par la gateway WS. */
@Controller({ path: 'conversations', version: '1' })
@UseGuards(JwtAuthGuard)
export class ChatController {
  constructor(
    private readonly chat: ChatService,
    private readonly dataSource: DataSource,
  ) {}

  @Get()
  async myConversations(@CurrentUser() user: AuthenticatedUser) {
    return this.dataSource.query(
      `SELECT c.id, c.type, c.title, c.avatar_url AS "avatarUrl",
              m.last_read_at AS "lastReadAt", m.muted
       FROM conversation_members m
       JOIN conversations c ON c.id = m.conversation_id
       WHERE m.user_id = $1
       ORDER BY c.created_at DESC`,
      [user.id],
    );
  }

  @Post()
  create(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateConversationDto) {
    if (dto.type === ConversationType.DM) {
      return this.chat.openDm(user.id, dto.userId!);
    }
    return this.chat.createGroup(user.id, dto.type, dto.title!, dto.description);
  }

  /** Annuaire des groupes publics (« Mamans de Paris »…). */
  @Get('discover')
  discover(@Query('q') q?: string) {
    return this.dataSource.query(
      `SELECT c.id, c.title, c.description, c.avatar_url AS "avatarUrl",
              (SELECT count(*) FROM conversation_members m
                WHERE m.conversation_id = c.id) AS "memberCount"
       FROM conversations c
       WHERE c.type = 'groupe_public'
         AND ($1::text IS NULL OR c.title ILIKE '%' || $1 || '%')
       ORDER BY "memberCount" DESC
       LIMIT 30`,
      [q ?? null],
    );
  }

  @Post(':id/members')
  @HttpCode(204)
  join(@CurrentUser() user: AuthenticatedUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.chat.joinPublicGroup(user.id, id);
  }

  @Get(':id/messages')
  getMessages(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Query('before') before?: string,
  ) {
    return this.chat.getMessages(user.id, id, before);
  }

  /** Fallback REST si le WebSocket est indisponible. */
  @Post(':id/messages')
  @Throttle({ default: { limit: 60, ttl: 60_000 } }) // 60/min
  sendMessage(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: SendMessageRestDto,
  ) {
    return this.chat.sendMessage(user.id, id, dto.body);
  }

  @Post(':id/read')
  @HttpCode(204)
  async read(@CurrentUser() user: AuthenticatedUser, @Param('id', ParseUUIDPipe) id: string) {
    await this.chat.markRead(user.id, id);
  }
}
