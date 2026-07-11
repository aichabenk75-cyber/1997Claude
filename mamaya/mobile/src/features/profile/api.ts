/** Profil de l'utilisatrice connectée. */
import { apiFetch } from '../../lib/api-client';

export interface Me {
  id: string;
  email: string;
  status: 'enceinte' | 'maman' | 'essai_bebe';
  displayName: string;
  avatarUrl: string | null;
  cityLabel: string | null;
}

export const meApi = {
  getMe() {
    return apiFetch<Me>('/v1/me');
  },
};

export const STATUS_LABELS: Record<Me['status'], string> = {
  enceinte: 'Future maman 🤰',
  maman: 'Maman 🤱',
  essai_bebe: 'En essai bébé ✨',
};
