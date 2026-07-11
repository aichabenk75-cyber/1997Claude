/**
 * Client API du module « Mamans autour de moi ».
 * Le serveur EXIGE un consentement RGPD 'geoloc' actif avant d'accepter la
 * position (403 geo/consent_required sinon) — d'où grantConsent/revokeConsent.
 */
import { apiFetch } from '../../lib/api-client';

export interface NearbyMom {
  userId: string;
  displayName: string;
  avatarUrl: string | null;
  distanceKm: number; // arrondie au km — le serveur n'envoie jamais de coordonnées
  zoneLabel: string;
}

export interface NearbyFilters {
  radiusKm: number;
  childAge?: string;      // ex. '0-6m'
  interests?: string[];   // slugs
}

const GEO_CONSENT_VERSION = '2026-01';

export const nearbyApi = {
  /** Consentement RGPD explicite, tracé en base — préalable à tout envoi de position. */
  grantConsent() {
    return apiFetch<void>('/v1/me/consents', {
      method: 'POST',
      body: { kind: 'geoloc', version: GEO_CONSENT_VERSION },
    });
  },

  /** Révocation : le serveur efface aussi la position immédiatement. */
  revokeConsent() {
    return apiFetch<void>('/v1/me/consents/geoloc', { method: 'DELETE' });
  },

  /** Envoie ma position — le floutage (~1 km) est fait CÔTÉ SERVEUR avant stockage. */
  updateMyLocation(lat: number, lng: number) {
    return apiFetch<void>('/v1/me/location', { method: 'PUT', body: { lat, lng } });
  },

  deleteMyLocation() {
    return apiFetch<void>('/v1/me/location', { method: 'DELETE' });
  },

  setGhostMode(enabled: boolean) {
    return apiFetch<void>('/v1/me/location/ghost-mode', { method: 'PATCH', body: { enabled } });
  },

  getNearby(filters: NearbyFilters): Promise<{ data: NearbyMom[] }> {
    const params = new URLSearchParams({ radius_km: String(filters.radiusKm) });
    if (filters.childAge) params.set('child_age', filters.childAge);
    if (filters.interests?.length) params.set('interests', filters.interests.join(','));
    return apiFetch(`/v1/nearby?${params}`);
  },
};
