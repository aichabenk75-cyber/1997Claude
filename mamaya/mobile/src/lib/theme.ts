/**
 * Design system Mamaya — chaleureux, féminin, arrondi (référence WeMoms).
 * Tout passe par ces jetons : ne jamais coder une couleur en dur dans un écran.
 */
export const COLORS = {
  // Marque
  rose: '#E9538F',
  roseDark: '#C93B77',
  roseSoft: '#FCE7F1',
  roseBg: '#FFF5F9',
  lavande: '#8B5CF6',

  // Neutres
  ink: '#26202B',
  gray: '#736A78',
  grayLight: '#A79FAC',
  border: '#F3E3EC',
  bg: '#FFFFFF',
  bgSoft: '#FFF5F9',
  field: '#FAF2F7',

  danger: '#DC2626',
  dangerBg: '#FEF2F2',
  success: '#16A34A',
  successBg: '#DCFCE7',
} as const;

/** Dégradés (expo-linear-gradient). */
export const GRADIENTS = {
  brand: ['#F97BB4', '#E9538F'] as [string, string],
  hero: ['#FDA4AF', '#E9538F'] as [string, string],
  fab: ['#F472B6', '#DB2777'] as [string, string],
} as const;

export const RADIUS = { sm: 10, md: 14, lg: 20, xl: 28, full: 999 } as const;

/** Ombres douces (iOS + Android). */
export const SHADOW = {
  card: {
    shadowColor: '#E9538F',
    shadowOpacity: 0.08,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
  fab: {
    shadowColor: '#DB2777',
    shadowOpacity: 0.35,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 5 },
    elevation: 6,
  },
} as const;

/** Duos pastel pour les avatars (choisis par hachage du nom → stable). */
export const AVATAR_GRADIENTS: [string, string][] = [
  ['#F9A8D4', '#EC4899'],
  ['#C4B5FD', '#8B5CF6'],
  ['#FDBA74', '#F97316'],
  ['#6EE7B7', '#10B981'],
  ['#93C5FD', '#3B82F6'],
  ['#FCD34D', '#F59E0B'],
];

export function avatarGradient(seed: string): [string, string] {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (Math.imul(31, h) + seed.charCodeAt(i)) | 0;
  return AVATAR_GRADIENTS[Math.abs(h) % AVATAR_GRADIENTS.length];
}
