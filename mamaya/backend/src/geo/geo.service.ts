import { createHmac } from 'node:crypto';
import { ForbiddenException, Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';

export interface NearbyFilters {
  radiusKm: number; // borné [2, 50] — rayon minimal anti-trilatération
  childAgeRange?: { minMonths: number; maxMonths: number };
  interests?: string[];
}

export interface NearbyMom {
  userId: string;
  displayName: string;
  avatarUrl: string | null;
  distanceKm: number; // arrondie au km — JAMAIS de coordonnées en sortie
  zoneLabel: string;  // cellule geohash ~5 km
}

const GRID_DEG = 0.01;          // grille ~1,1 km
const JITTER_MAX_DEG = 0.004;   // ±~400 m, déterministe par utilisatrice
const K_ANONYMITY_MIN = 5;      // moins de 5 profils dans la zone → résultat vide
const MIN_RADIUS_KM = 2;
const MAX_RADIUS_KM = 50;

/**
 * Géolocalisation « Mamans autour de moi ».
 * Invariant central : la position EXACTE n'est jamais persistée ni loguée —
 * le floutage a lieu ici, avant toute écriture.
 */
@Injectable()
export class GeoService {
  constructor(
    private readonly dataSource: DataSource,
    /** Secret serveur dédié au jitter (env/KMS) — distinct des clés JWT. */
    private readonly jitterSecret: string,
  ) {}

  /**
   * Floutage : snap sur une grille ~1,1 km + décalage DÉTERMINISTE par
   * utilisatrice (HMAC). Déterministe car un bruit aléatoire à chaque envoi
   * se moyennerait par observations répétées ; un décalage fixe ne révèle
   * rien de plus à la 1000ᵉ requête qu'à la 1ʳᵉ.
   */
  fuzzPosition(userId: string, lat: number, lng: number): { lat: number; lng: number } {
    const snappedLat = Math.round(lat / GRID_DEG) * GRID_DEG;
    const snappedLng = Math.round(lng / GRID_DEG) * GRID_DEG;

    const mac = createHmac('sha256', this.jitterSecret).update(userId).digest();
    // 2 × 16 bits du HMAC → décalages stables dans [-JITTER_MAX, +JITTER_MAX]
    const jLat = (mac.readUInt16BE(0) / 0xffff - 0.5) * 2 * JITTER_MAX_DEG;
    const jLng = (mac.readUInt16BE(2) / 0xffff - 0.5) * 2 * JITTER_MAX_DEG;

    return { lat: snappedLat + jLat, lng: snappedLng + jLng };
  }

  /** Upsert de la position floutée. Exige le consentement 'geoloc' actif. */
  async updateLocation(userId: string, lat: number, lng: number): Promise<void> {
    const consent = await this.dataSource.query(
      `SELECT 1 FROM consents
       WHERE user_id = $1 AND kind = 'geoloc' AND revoked_at IS NULL
       LIMIT 1`,
      [userId],
    );
    if (consent.length === 0) {
      throw new ForbiddenException({ code: 'geo/consent_required' });
    }

    const fuzzed = this.fuzzPosition(userId, lat, lng);
    // 1 ligne par utilisatrice — pas d'historique de déplacements, par conception.
    await this.dataSource.query(
      `INSERT INTO user_locations (user_id, geo, geohash5, consented_at, updated_at)
       VALUES ($1, ST_SetSRID(ST_MakePoint($2, $3), 4326)::geography,
               ST_GeoHash(ST_MakePoint($2, $3), 5), now(), now())
       ON CONFLICT (user_id) DO UPDATE
         SET geo = EXCLUDED.geo, geohash5 = EXCLUDED.geohash5, updated_at = now()`,
      [userId, fuzzed.lng, fuzzed.lat],
    );
  }

  /** Mode Fantôme — effet immédiat : sortie de l'index partiel de recherche. */
  async setGhostMode(userId: string, enabled: boolean): Promise<void> {
    await this.dataSource.query(
      `UPDATE user_locations SET ghost_mode = $2, updated_at = now() WHERE user_id = $1`,
      [userId, enabled],
    );
  }

  /** Effacement immédiat (bouton dédié, révocation du consentement, ou suppression du compte). */
  async deleteLocation(userId: string): Promise<void> {
    await this.dataSource.query(`DELETE FROM user_locations WHERE user_id = $1`, [userId]);
  }

  /** Recherche autour de moi — depuis MA position floutée stockée. */
  async findNearby(meId: string, filters: NearbyFilters): Promise<NearbyMom[]> {
    const radiusM =
      Math.min(Math.max(filters.radiusKm, MIN_RADIUS_KM), MAX_RADIUS_KM) * 1000;

    const rows: Array<NearbyMom & { distanceKm: string }> = await this.dataSource.query(
      `WITH me AS (
         SELECT geo FROM user_locations WHERE user_id = $1 AND ghost_mode = false
       )
       SELECT u.id                                   AS "userId",
              p.display_name                          AS "displayName",
              p.avatar_url                            AS "avatarUrl",
              GREATEST(1, round(ST_Distance(l.geo, me.geo) / 1000)) AS "distanceKm",
              l.geohash5                              AS "zoneLabel"
       FROM user_locations l
       CROSS JOIN me
       JOIN users u         ON u.id = l.user_id AND u.deleted_at IS NULL
       JOIN user_profiles p ON p.user_id = u.id
       WHERE l.ghost_mode = false
         AND l.user_id <> $1
         AND ST_DWithin(l.geo, me.geo, $2)
         AND NOT EXISTS (SELECT 1 FROM user_blocks b
                         WHERE (b.blocker_id = $1 AND b.blocked_id = u.id)
                            OR (b.blocker_id = u.id AND b.blocked_id = $1))
         AND ($3::int IS NULL OR EXISTS (
                SELECT 1 FROM children c
                WHERE c.user_id = u.id
                  AND c.birth_month BETWEEN
                        (now() - make_interval(months => $4))::date
                    AND (now() - make_interval(months => $3))::date))
         AND ($5::text[] IS NULL OR EXISTS (
                SELECT 1 FROM user_interests ui
                JOIN interests i ON i.id = ui.interest_id
                WHERE ui.user_id = u.id AND i.slug = ANY($5)))
       ORDER BY l.geo <-> me.geo
       LIMIT 50`,
      [
        meId,
        radiusM,
        filters.childAgeRange?.minMonths ?? null,
        filters.childAgeRange?.maxMonths ?? null,
        filters.interests?.length ? filters.interests : null,
      ],
    );

    // k-anonymat : en zone peu dense, ne pas permettre d'isoler une personne.
    if (rows.length < K_ANONYMITY_MIN) return [];

    return rows.map((r) => ({ ...r, distanceKm: Number(r.distanceKm) }));
  }
}
