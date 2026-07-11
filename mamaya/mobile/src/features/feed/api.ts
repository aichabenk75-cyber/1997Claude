/** Client API du fil et des posts. */
import { apiFetch } from '../../lib/api-client';

export interface FeedItem {
  id: string;
  type: 'texte' | 'photo' | 'sondage';
  body: string | null;
  categoryId: number | null;
  createdAt: string;
  likeCount: number;
  commentCount: number;
  shareCount: number;
  author: { id: string; displayName: string; avatarUrl: string | null };
}

export type FeedMode = 'algo' | 'chrono';

export const feedApi = {
  getFeed(mode: FeedMode, cursor?: string) {
    const params = new URLSearchParams({ mode });
    if (cursor) params.set('cursor', cursor);
    return apiFetch<{ data: FeedItem[]; nextCursor: string | null }>(`/v1/feed?${params}`);
  },

  createPost(body: string) {
    return apiFetch<{ id: string; moderation: string }>('/v1/posts', {
      method: 'POST',
      body: { type: 'texte', body },
    });
  },

  like(postId: string) {
    return apiFetch<void>(`/v1/posts/${postId}/reactions`, { method: 'PUT' });
  },

  unlike(postId: string) {
    return apiFetch<void>(`/v1/posts/${postId}/reactions`, { method: 'DELETE' });
  },

  addComment(postId: string, body: string) {
    return apiFetch<{ id: string; moderation: string }>(`/v1/posts/${postId}/comments`, {
      method: 'POST',
      body: { body },
    });
  },
};
