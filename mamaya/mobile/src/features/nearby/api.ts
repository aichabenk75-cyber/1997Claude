/**
 * Client API du module « Mamans autour de moi ».
 * `apiFetch` : wrapper fetch de l'app (base URL, JWT via expo-secure-store,
 * refresh automatique, certificate pinning configuré au niveau natif).
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

export const nearbyApi = {
  /** Envoie ma position — le floutage (~1 km) est fait CÔTÉ SERVEUR avant stockage. */
  updateMyLocation(lat: number, lng: number) {
    return apiFetch('/v1/me/location', { method: 'PUT', body: { lat, lng } });
  },

  deleteMyLocation() {
    return apiFetch('/v1/me/location', { method: 'DELETE' });
  },

  setGhostMode(enabled: boolean) {
    return apiFetch('/v1/me/location/ghost-mode', { method: 'PATCH', body: { enabled } });
  },

  getNearby(filters: NearbyFilters): Promise<{ data: NearbyMom[] }> {
    const params = new URLSearchParams({ radius_km: String(filters.radiusKm) });
    if (filters.childAge) params.set('child_age', filters.childAge);
    if (filters.interests?.length) params.set('interests', filters.interests.join(','));
    return apiFetch(`/v1/nearby?${params}`);
  },
};
