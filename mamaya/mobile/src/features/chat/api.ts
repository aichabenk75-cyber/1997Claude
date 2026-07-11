/** Client API du chat (REST — le temps réel WS pourra venir ensuite). */
import { apiFetch } from '../../lib/api-client';

export interface ConversationSummary {
  id: string;
  type: 'dm' | 'groupe_prive' | 'groupe_public';
  title: string | null;
  avatarUrl: string | null;
  lastReadAt: string | null;
  muted: boolean;
}

export interface PublicGroup {
  id: string;
  title: string;
  description: string | null;
  avatarUrl: string | null;
  memberCount: number;
}

export interface Message {
  id: string;
  conversationId: string;
  senderId: string;
  body: string;
  createdAt: string;
}

export const chatApi = {
  myConversations() {
    return apiFetch<ConversationSummary[]>('/v1/conversations');
  },

  discoverGroups(q?: string) {
    const params = q ? `?q=${encodeURIComponent(q)}` : '';
    return apiFetch<PublicGroup[]>(`/v1/conversations/discover${params}`);
  },

  joinGroup(conversationId: string) {
    return apiFetch<void>(`/v1/conversations/${conversationId}/members`, { method: 'POST' });
  },

  openDm(userId: string) {
    return apiFetch<{ id: string }>('/v1/conversations', {
      method: 'POST',
      body: { type: 'dm', userId },
    });
  },

  getMessages(conversationId: string, before?: string) {
    const params = before ? `?before=${encodeURIComponent(before)}` : '';
    return apiFetch<{ data: Message[]; nextCursor: string | null }>(
      `/v1/conversations/${conversationId}/messages${params}`,
    );
  },

  sendMessage(conversationId: string, body: string) {
    return apiFetch<Message>(`/v1/conversations/${conversationId}/messages`, {
      method: 'POST',
      body: { body },
    });
  },

  markRead(conversationId: string) {
    return apiFetch<void>(`/v1/conversations/${conversationId}/read`, { method: 'POST' });
  },
};
