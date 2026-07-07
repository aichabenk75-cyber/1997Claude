import { Logger, UsePipes, ValidationPipe } from '@nestjs/common';
import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { IsOptional, IsString, IsUUID, Length } from 'class-validator';
import { Server, Socket } from 'socket.io';
import { TokenService } from '../auth/token.service';
import { ChatService } from './chat.service';

class SendMessageDto {
  @IsUUID()
  conversationId: string;

  // Idempotence côté client : renvoyé dans l'ack pour réconcilier l'UI optimiste
  @IsString()
  clientId: string;

  @IsString()
  @Length(1, 4000)
  body: string;

  @IsOptional()
  @IsString()
  mediaKey?: string;
}

class TypingDto {
  @IsUUID()
  conversationId: string;
}

/**
 * Gateway temps réel du chat.
 * - Auth au handshake : JWT dans `auth.token` → refus immédiat sinon.
 * - 1 room Socket.IO par conversation (`conv:<id>`) + 1 room par utilisatrice
 *   (`user:<id>`) pour les notifications ciblées.
 * - Scaling horizontal : brancher l'adapter Redis de Socket.IO
 *   (`@socket.io/redis-adapter`) dans main.ts → N instances, mêmes rooms.
 * - Les événements de frappe sont éphémères : jamais persistés.
 */
@WebSocketGateway({ namespace: '/chat', cors: false })
@UsePipes(new ValidationPipe({ whitelist: true }))
export class ChatGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(ChatGateway.name);

  constructor(
    private readonly tokens: TokenService,
    private readonly chat: ChatService,
    // Hors-ligne → push FCM/APNs (le payload push ne contient JAMAIS le texte)
    @InjectQueue('push') private readonly pushQueue: Queue,
  ) {}

  async handleConnection(socket: Socket): Promise<void> {
    try {
      const token = socket.handshake.auth?.token as string | undefined;
      if (!token) throw new Error('missing token');
      const payload = await this.tokens.verifyAccessToken(token);
      socket.data.userId = payload.sub;
      await socket.join(`user:${payload.sub}`);
    } catch {
      socket.disconnect(true);
    }
  }

  handleDisconnect(socket: Socket): void {
    // Rien à nettoyer : l'état de présence vit dans les rooms Socket.IO/Redis.
    void socket;
  }

  /** Rejoindre la room d'une conversation (autorisation : être membre). */
  @SubscribeMessage('conversation:join')
  async joinRoom(
    @ConnectedSocket() socket: Socket,
    @MessageBody() dto: TypingDto,
  ): Promise<{ ok: boolean }> {
    await this.chat.assertMember(socket.data.userId, dto.conversationId);
    await socket.join(`conv:${dto.conversationId}`);
    return { ok: true };
  }

  @SubscribeMessage('message:send')
  async sendMessage(
    @ConnectedSocket() socket: Socket,
    @MessageBody() dto: SendMessageDto,
  ): Promise<{ id: string; clientId: string; createdAt: string }> {
    const message = await this.chat.sendMessage(
      socket.data.userId,
      dto.conversationId,
      dto.body,
      dto.mediaKey,
    );

    // Diffusion aux membres connectés
    this.server.to(`conv:${dto.conversationId}`).emit('message:new', message);

    // Push pour les membres hors ligne — job async, contenu jamais dans le push
    const memberIds = await this.chat.memberIds(dto.conversationId);
    await this.pushQueue.add('chat-message', {
      conversationId: dto.conversationId,
      senderId: socket.data.userId,
      recipientIds: memberIds.filter((id) => id !== socket.data.userId),
      messageId: message.id,
    });

    // Ack pour l'expéditrice (réconciliation de l'UI optimiste)
    return {
      id: message.id,
      clientId: dto.clientId,
      createdAt: message.createdAt.toISOString(),
    };
  }

  @SubscribeMessage('typing:start')
  async typingStart(@ConnectedSocket() socket: Socket, @MessageBody() dto: TypingDto) {
    await this.chat.assertMember(socket.data.userId, dto.conversationId);
    socket.to(`conv:${dto.conversationId}`).emit('typing:start', {
      conversationId: dto.conversationId,
      userId: socket.data.userId,
    });
  }

  @SubscribeMessage('typing:stop')
  async typingStop(@ConnectedSocket() socket: Socket, @MessageBody() dto: TypingDto) {
    socket.to(`conv:${dto.conversationId}`).emit('typing:stop', {
      conversationId: dto.conversationId,
      userId: socket.data.userId,
    });
  }

  @SubscribeMessage('conversation:read')
  async markRead(@ConnectedSocket() socket: Socket, @MessageBody() dto: TypingDto) {
    const at = await this.chat.markRead(socket.data.userId, dto.conversationId);
    socket.to(`conv:${dto.conversationId}`).emit('conversation:read', {
      conversationId: dto.conversationId,
      userId: socket.data.userId,
      lastReadAt: at.toISOString(),
    });
  }
}
