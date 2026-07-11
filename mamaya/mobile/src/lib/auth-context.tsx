/**
 * Session utilisatrice : connexion (avec 2FA éventuelle), inscription,
 * déconnexion, restauration au démarrage. L'identité (userId) est lue dans le
 * payload du JWT — jamais re-demandée au serveur.
 */
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import {
  apiFetch,
  clearTokens,
  getAccessToken,
  getRefreshToken,
  saveTokens,
  setSessionExpiredHandler,
} from './api-client';

export type UserStatus = 'enceinte' | 'maman' | 'essai_bebe';

export interface RegisterInput {
  email: string;
  password: string;
  displayName: string;
  status: UserStatus;
  dueDate?: string; // AAAA-MM-JJ, requise si enceinte
  cityLabel?: string;
}

interface TokenPair {
  accessToken: string;
  refreshToken: string;
}

type LoginResult = { twoFactorRequired: false } | { twoFactorRequired: true; ticket: string };

interface AuthContextValue {
  /** null = session en cours de restauration (splash). */
  ready: boolean;
  userId: string | null;
  login(email: string, password: string): Promise<LoginResult>;
  verifyTwoFactor(ticket: string, code: string): Promise<void>;
  register(input: RegisterInput): Promise<void>;
  logout(): Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

const CGU_VERSION = '2026-01';
const HEALTH_CONSENT_VERSION = '2026-01';

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);

  // Restauration au démarrage : un refresh token présent suffit — le premier
  // appel API fera la rotation si l'access token a expiré.
  useEffect(() => {
    (async () => {
      const [access, refresh] = await Promise.all([getAccessToken(), getRefreshToken()]);
      if (refresh && access) setUserId(subjectOf(access));
      setReady(true);
    })();
  }, []);

  // Refresh définitivement refusé (révocation, expiration) → retour connexion.
  useEffect(() => {
    setSessionExpiredHandler(() => setUserId(null));
    return () => setSessionExpiredHandler(null);
  }, []);

  const adoptTokens = useCallback(async (pair: TokenPair) => {
    await saveTokens(pair.accessToken, pair.refreshToken);
    setUserId(subjectOf(pair.accessToken));
  }, []);

  const login = useCallback(
    async (email: string, password: string): Promise<LoginResult> => {
      const res = await apiFetch<
        | { twoFactorRequired: true; ticket: string }
        | ({ twoFactorRequired: false } & TokenPair)
      >('/v1/auth/login', { method: 'POST', auth: false, body: { email, password } });

      if (res.twoFactorRequired) return { twoFactorRequired: true, ticket: res.ticket };
      await adoptTokens(res);
      return { twoFactorRequired: false };
    },
    [adoptTokens],
  );

  const verifyTwoFactor = useCallback(
    async (ticket: string, code: string) => {
      const pair = await apiFetch<TokenPair>('/v1/auth/2fa/verify', {
        method: 'POST',
        auth: false,
        body: { ticket, code },
      });
      await adoptTokens(pair);
    },
    [adoptTokens],
  );

  const register = useCallback(
    async (input: RegisterInput) => {
      await apiFetch('/v1/auth/register', {
        method: 'POST',
        auth: false,
        body: {
          ...input,
          cguVersion: CGU_VERSION,
          // Statut « enceinte » = donnée de santé (art. 9 RGPD) → opt-in tracé
          ...(input.status === 'enceinte'
            ? { consentHealthDataVersion: HEALTH_CONSENT_VERSION }
            : {}),
        },
      });
      // Compte créé → connexion immédiate avec les mêmes identifiants.
      await login(input.email, input.password);
    },
    [login],
  );

  const logout = useCallback(async () => {
    const refreshToken = await getRefreshToken();
    try {
      if (refreshToken) {
        await apiFetch('/v1/auth/logout', { method: 'POST', body: { refreshToken } });
      }
    } catch {
      // La révocation serveur peut échouer hors-ligne — on sort quand même.
    }
    await clearTokens();
    setUserId(null);
  }, []);

  const value = useMemo(
    () => ({ ready, userId, login, verifyTwoFactor, register, logout }),
    [ready, userId, login, verifyTwoFactor, register, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth doit être utilisé sous <AuthProvider>');
  return ctx;
}

/** Extrait le `sub` (userId) d'un JWT sans dépendance — décodage base64url local. */
function subjectOf(jwt: string): string | null {
  try {
    const payload = jwt.split('.')[1];
    return (JSON.parse(base64UrlDecode(payload)) as { sub?: string }).sub ?? null;
  } catch {
    return null;
  }
}

const B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

function base64UrlDecode(input: string): string {
  const s = input.replace(/-/g, '+').replace(/_/g, '/');
  let bits = 0;
  let acc = 0;
  const bytes: number[] = [];
  for (const ch of s) {
    const v = B64.indexOf(ch);
    if (v < 0) continue; // padding éventuel
    acc = (acc << 6) | v;
    bits += 6;
    if (bits >= 8) {
      bits -= 8;
      bytes.push((acc >> bits) & 0xff);
    }
  }
  return utf8Decode(bytes);
}

function utf8Decode(bytes: number[]): string {
  let out = '';
  for (let i = 0; i < bytes.length; ) {
    const b = bytes[i];
    if (b < 0x80) {
      out += String.fromCharCode(b);
      i += 1;
    } else if (b < 0xe0) {
      out += String.fromCharCode(((b & 0x1f) << 6) | (bytes[i + 1] & 0x3f));
      i += 2;
    } else {
      out += String.fromCharCode(
        ((b & 0x0f) << 12) | ((bytes[i + 1] & 0x3f) << 6) | (bytes[i + 2] & 0x3f),
      );
      i += 3;
    }
  }
  return out;
}
