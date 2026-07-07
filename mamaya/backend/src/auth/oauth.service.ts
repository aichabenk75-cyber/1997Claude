import { Injectable, UnauthorizedException } from '@nestjs/common';
import { createRemoteJWKSet, jwtVerify } from 'jose';
import { AuthProvider } from '../users/user.entity';

export interface OAuthIdentity {
  provider: AuthProvider;
  sub: string; // identifiant stable chez le fournisseur
  email: string;
  emailVerified: boolean;
}

/**
 * Vérification CÔTÉ SERVEUR des tokens OAuth natifs (Google Sign-In,
 * Sign in with Apple). On ne fait jamais confiance au mobile : le token
 * d'identité est revalidé contre les JWKS publics du fournisseur
 * (signature, émetteur, audience, expiration).
 */
@Injectable()
export class OAuthService {
  private readonly googleJwks = createRemoteJWKSet(
    new URL('https://www.googleapis.com/oauth2/v3/certs'),
  );
  private readonly appleJwks = createRemoteJWKSet(
    new URL('https://appleid.apple.com/auth/keys'),
  );

  constructor(
    private readonly googleClientIds: string[], // client IDs iOS + Android
    private readonly appleBundleId: string,
  ) {}

  async verifyGoogle(idToken: string): Promise<OAuthIdentity> {
    try {
      const { payload } = await jwtVerify(idToken, this.googleJwks, {
        issuer: ['https://accounts.google.com', 'accounts.google.com'],
        audience: this.googleClientIds,
      });
      return {
        provider: AuthProvider.GOOGLE,
        sub: payload.sub!,
        email: String(payload.email ?? ''),
        emailVerified: payload.email_verified === true,
      };
    } catch {
      throw new UnauthorizedException({ code: 'auth/invalid_oauth_token' });
    }
  }

  async verifyApple(identityToken: string): Promise<OAuthIdentity> {
    try {
      const { payload } = await jwtVerify(identityToken, this.appleJwks, {
        issuer: 'https://appleid.apple.com',
        audience: this.appleBundleId,
      });
      return {
        provider: AuthProvider.APPLE,
        sub: payload.sub!,
        // Peut être une adresse relais Apple (private relay) — on la respecte.
        email: String(payload.email ?? ''),
        emailVerified: payload.email_verified === true || payload.email_verified === 'true',
      };
    } catch {
      throw new UnauthorizedException({ code: 'auth/invalid_oauth_token' });
    }
  }
}
