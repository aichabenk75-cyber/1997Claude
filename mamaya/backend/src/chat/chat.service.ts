import { createHash, randomUUID } from 'node:crypto';
import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { DataSource } from 'typeorm';
import { EnvelopeCryptoService } from '../crypto/envelope-crypto.service';
import {
  Conversation,
  ConversationMember,
  ConversationType,
  Message,
} from './conversation.entity';

export interface MessageView {
  id: string;
  conversationId: string;
  senderId: string;
  body: string; // déchiffré à la volée, uniquement pour les membres
  createdAt: Date;
}

const PAGE_SIZE = 50;

@Injectable()
export class ChatService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly crypto: EnvelopeCryptoService,
  ) {}

  /** DM idempotent : une seule conversation par paire, quelle que soit qui l'ouvre. */
  async openDm(meId: string, otherId: string): Promise<Conversation> {
    if (meId === otherId) throw new ForbiddenException();
    await this.assertNotBlocked(meId, otherId);

    const dmKey = createHash('sha256')
      .update([meId, otherId].sort().join(':'))
      .digest('hex');

    return this.dataSource.transaction(async (em) => {
      const existing = await em.findOneBy(Conversation, { dmKey });
      if (existing) return existing;

      const conv = await em.save(
        em.create(Conversation, { type: ConversationType.DM, dmKey, createdBy: meId }),
      );
      await em.save([
        em.create(ConversationMember, { conversationId: conv.id, userId: meId }),
        em.create(ConversationMember, { conversationId: conv.id, userId: otherId }),
      ]);
      return conv;
    });
  }

  async createGroup(
    creatorId: string,
    type: ConversationType.GROUPE_PRIVE | ConversationType.GROUPE_PUBLIC,
    title: string,
    description?: string,
  ): Promise<Conversation> {
    return this.dataSource.transaction(async (em) => {
      const conv = await em.save(
        em.create(Conversation, { type, title, description: description ?? null, createdBy: creatorId }),
      );
      await em.save(
        em.create(ConversationMember, {
          conversationId: conv.id,
          userId: creatorId,
          role: 'admin',
        }),
      );
      return conv;
    });
  }

  /** Rejoindre un groupe PUBLIC librement ; les groupes privés passent par une invitation d'admin. */
  async joinPublicGroup(userId: string, conversationId: string): Promise<void> {
    const conv = await this.dataSource
      .getRepository(Conversation)
      .findOneBy({ id: conversationId });
    if (!conv || conv.type !== ConversationType.GROUPE_PUBLIC) {
      throw new NotFoundException();
    }
    await this.dataSource
      .getRepository(ConversationMember)
      .upsert({ conversationId, userId }, ['conversationId', 'userId']);
  }

  /**
   * Envoi : autorisation (membre ?), chiffrement avec la clé de l'expéditrice,
   * insertion, puis renvoi du message en clair pour la diffusion WebSocket.
   */
  async sendMessage(
    senderId: string,
    conversationId: string,
    body: string,
    mediaS3Key?: string,
  ): Promise<MessageView> {
    await this.assertMember(senderId, conversationId);

    const message: Message = {
      id: randomUUID(),
      conversationId,
      senderId,
      bodyEnc: await this.crypto.encryptForUser(senderId, 'message.body', body),
      keyId: senderId, // la DEK de l'expéditrice chiffre ses messages
      mediaS3Key: mediaS3Key ?? null,
      createdAt: new Date(),
      deletedAt: null,
    };
    await this.dataSource.getRepository(Message).insert(message);

    return { id: message.id, conversationId, senderId, body, createdAt: message.createdAt };
  }

  /** Historique paginé, déchiffré à la volée — être membre est la seule autorisation. */
  async getMessages(
    userId: string,
    conversationId: string,
    before?: string,
  ): Promise<{ data: MessageView[]; nextCursor: string | null }> {
    await this.assertMember(userId, conversationId);

    const rows = await this.dataSource.getRepository(Message).find({
      where: { conversationId },
      order: { createdAt: 'DESC' },
      take: PAGE_SIZE + 1,
      ...(before ? { where: { conversationId, createdAt: new Date(before) as any } } : {}),
    });

    const hasMore = rows.length > PAGE_SIZE;
    const page = hasMore ? rows.slice(0, PAGE_SIZE) : rows;

    const data = await Promise.all(
      page
        .filter((m) => !m.deletedAt)
        .map(async (m) => ({
          id: m.id,
          conversationId: m.conversationId,
          senderId: m.senderId,
          body: (
            await this.crypto.decryptForUser(m.keyId, 'message.body', m.bodyEnc)
          ).toString('utf8'),
          createdAt: m.createdAt,
        })),
    );

    return {
      data,
      nextCursor: hasMore ? page[page.length - 1].createdAt.toISOString() : null,
    };
  }

  async markRead(userId: string, conversationId: string): Promise<Date> {
    const now = new Date();
    await this.dataSource
      .getRepository(ConversationMember)
      .update({ conversationId, userId }, { lastReadAt: now });
    return now;
  }

  async memberIds(conversationId: string): Promise<string[]> {
    const members = await this.dataSource
      .getRepository(ConversationMember)
      .findBy({ conversationId });
    return members.map((m) => m.userId);
  }

  async assertMember(userId: string, conversationId: string): Promise<void> {
    const member = await this.dataSource
      .getRepository(ConversationMember)
      .findOneBy({ conversationId, userId });
    if (!member) throw new ForbiddenException({ code: 'chat/not_member' });
  }

  private async assertNotBlocked(a: string, b: string): Promise<void> {
    const rows = await this.dataSource.query(
      `SELECT 1 FROM user_blocks
       WHERE (blocker_id = $1 AND blocked_id = $2)
          OR (blocker_id = $2 AND blocked_id = $1) LIMIT 1`,
      [a, b],
    );
    // Même erreur qu'un utilisateur inexistant : ne révèle pas le blocage.
    if (rows.length > 0) throw new NotFoundException();
  }
}
