import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';

export interface FeedItem {
  id: string;
  type: string;
  body: string | null;
  categoryId: number | null;
  createdAt: string;
  likeCount: number;
  commentCount: number;
  shareCount: number;
  /** Clés des photos (GET /v1/media/:key) dans l'ordre d'affichage. */
  mediaKeys: string[];
  author: { id: string; displayName: string; avatarUrl: string | null };
}

const PAGE_SIZE = 20;
const ALGO_WINDOW_DAYS = 14; // le mode algo ne classe que le récent

/**
 * Feed V1 en mode « pull » : requête paginée par curseur, filtrée sur les
 * centres d'intérêt + le stade (grossesse / âge des enfants) de la lectrice.
 * Seuls les posts APPROUVÉS par la modération sont servis — c'est structurel
 * (index partiel), pas un filtre optionnel.
 */
@Injectable()
export class FeedService {
  constructor(private readonly dataSource: DataSource) {}

  async getFeed(
    userId: string,
    mode: 'algo' | 'chrono',
    cursor?: string,
  ): Promise<{ data: FeedItem[]; nextCursor: string | null }> {
    return mode === 'chrono'
      ? this.chronoFeed(userId, cursor)
      : this.algoFeed(userId, cursor);
  }

  /** Antéchronologique pur — curseur keyset (created_at, id). */
  private async chronoFeed(userId: string, cursor?: string) {
    const c = decodeCursor(cursor);
    const rows = await this.dataSource.query(
      `${FEED_SELECT}
       WHERE ${FEED_BASE_FILTER}
         AND ($2::timestamptz IS NULL OR (p.created_at, p.id) < ($2, $3::uuid))
       ORDER BY p.created_at DESC, p.id DESC
       LIMIT ${PAGE_SIZE + 1}`,
      [userId, c?.a ?? null, c?.b ?? null],
    );
    return paginate(rows, (last) => encodeCursor(last.createdAt, last.id));
  }

  /**
   * Algorithmique : score = engagement pondéré / décroissance temporelle
   * (type « hot ranking »), sur une fenêtre récente. Le score est déterministe
   * → curseur keyset (score, id) stable entre deux pages.
   */
  private async algoFeed(userId: string, cursor?: string) {
    const c = decodeCursor(cursor);
    const rows = await this.dataSource.query(
      `${ALGO_FEED_SELECT}
       WHERE ${FEED_BASE_FILTER}
         AND p.created_at > now() - interval '${ALGO_WINDOW_DAYS} days'
         AND (
           -- posts de mes catégories d'intérêt…
           p.category_id IN (SELECT ui.interest_id FROM user_interests ui WHERE ui.user_id = $1)
           -- …ou de mon stade (grossesse / âge des enfants)…
           OR p.audience_stage IN (SELECT stage FROM user_stages($1))
           -- …ou des mamans que je suis
           OR p.author_id IN (SELECT f.followee_id FROM follows f WHERE f.follower_id = $1)
         )
         AND ($2::float8 IS NULL OR
              ((1 + p.like_count + 2 * p.comment_count + 3 * p.share_count)
               / power(extract(epoch FROM now() - p.created_at) / 3600 + 2, 1.4), p.id)
              < ($2, $3::uuid))
       ORDER BY score DESC, p.id DESC
       LIMIT ${PAGE_SIZE + 1}`,
      [userId, c?.a ?? null, c?.b ?? null],
    );
    return paginate(rows, (last) => encodeCursor(last.score, last.id));
  }
}

// Fragments SQL partagés — l'exclusion des personnes bloquées est bilatérale.
const MEDIA_KEYS_SQL = `
         (SELECT coalesce(json_agg(pm.s3_key ORDER BY pm.position), '[]'::json)
          FROM post_media pm WHERE pm.post_id = p.id) AS "mediaKeys"`;

const FEED_SELECT = `
  SELECT p.id, p.type, p.body, p.category_id AS "categoryId",
         p.created_at AS "createdAt",
         p.like_count AS "likeCount", p.comment_count AS "commentCount",
         p.share_count AS "shareCount",
         json_build_object('id', u.id, 'displayName', pr.display_name,
                           'avatarUrl', pr.avatar_url) AS author,${MEDIA_KEYS_SQL}
  FROM posts p
  JOIN users u ON u.id = p.author_id AND u.deleted_at IS NULL
  JOIN user_profiles pr ON pr.user_id = u.id`;

const ALGO_FEED_SELECT = `
  SELECT p.id, p.type, p.body, p.category_id AS "categoryId",
         p.created_at AS "createdAt",
         p.like_count AS "likeCount", p.comment_count AS "commentCount",
         p.share_count AS "shareCount",
         json_build_object('id', u.id, 'displayName', pr.display_name,
                           'avatarUrl', pr.avatar_url) AS author,${MEDIA_KEYS_SQL},
         (1 + p.like_count + 2 * p.comment_count + 3 * p.share_count)
         / power(extract(epoch FROM now() - p.created_at) / 3600 + 2, 1.4) AS score
  FROM posts p
  JOIN users u ON u.id = p.author_id AND u.deleted_at IS NULL
  JOIN user_profiles pr ON pr.user_id = u.id`;

const FEED_BASE_FILTER = `
  p.moderation = 'approuve' AND p.deleted_at IS NULL
  AND NOT EXISTS (SELECT 1 FROM user_blocks b
                  WHERE (b.blocker_id = $1 AND b.blocked_id = p.author_id)
                     OR (b.blocker_id = p.author_id AND b.blocked_id = $1))`;

function paginate(rows: any[], cursorOf: (last: any) => string) {
  const hasMore = rows.length > PAGE_SIZE;
  const data = hasMore ? rows.slice(0, PAGE_SIZE) : rows;
  return { data, nextCursor: hasMore ? cursorOf(data[data.length - 1]) : null };
}

function encodeCursor(a: unknown, b: string): string {
  return Buffer.from(JSON.stringify({ a, b }), 'utf8').toString('base64url');
}

function decodeCursor(cursor?: string): { a: unknown; b: string } | null {
  if (!cursor) return null;
  try {
    return JSON.parse(Buffer.from(cursor, 'base64url').toString('utf8'));
  } catch {
    return null; // curseur corrompu → première page (jamais d'erreur 500)
  }
}
