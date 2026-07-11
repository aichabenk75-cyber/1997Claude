/** Client API du fil, des posts et des photos. */
import { API_BASE_URL, apiFetch } from '../../lib/api-client';

export interface FeedItem {
  id: string;
  type: 'texte' | 'photo' | 'sondage';
  body: string | null;
  categoryId: number | null;
  createdAt: string;
  likeCount: number;
  commentCount: number;
  shareCount: number;
  mediaKeys: string[];
  author: { id: string; displayName: string; avatarUrl: string | null };
}

export type FeedMode = 'algo' | 'chrono';

/** URL affichable d'une photo à partir de sa clé serveur. */
export function mediaUrl(key: string): string {
  return `${API_BASE_URL}/v1/media/${key}`;
}

export const feedApi = {
  getFeed(mode: FeedMode, cursor?: string) {
    const params = new URLSearchParams({ mode });
    if (cursor) params.set('cursor', cursor);
    return apiFetch<{ data: FeedItem[]; nextCursor: string | null }>(`/v1/feed?${params}`);
  },

  /** Envoie une photo (base64) → clé à passer ensuite à createPost. */
  async uploadPhoto(mime: string, dataBase64: string): Promise<string> {
    const { key } = await apiFetch<{ key: string }>('/v1/media', {
      method: 'POST',
      body: { mime, dataBase64 },
    });
    return key;
  },

  createPost(body: string, mediaKeys: string[] = []) {
    return apiFetch<{ id: string; moderation: string }>('/v1/posts', {
      method: 'POST',
      body: mediaKeys.length > 0
        ? { type: 'photo', body: body || undefined, mediaKeys }
        : { type: 'texte', body },
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
