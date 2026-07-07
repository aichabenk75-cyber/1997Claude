import { createHash, randomBytes } from 'node:crypto';
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { importPKCS8, importSPKI, jwtVerify, SignJWT, type KeyLike } from 'jose';

export interface AccessTokenPayload {
  sub: string; // user id
  role: string;
  jti: string;
}

const ISSUER = 'mamaya';
const AUDIENCE = 'mamaya-app';
const ACCESS_TTL = '15m';
export const REFRESH_TTL_DAYS = 30;

/**
 * JWT d'accès signés en EdDSA (Ed25519) — asymétrique : les services qui
 * VÉRIFIENT n'ont que la clé publique, seule l'API d'auth détient la privée.
 * Le header porte un `kid` pour permettre la rotation des clés de signature
 * sans invalider les sessions en cours.
 */
@Injectable()
export class TokenService {
  private privateKey: KeyLike;
  private publicKeys: Map<string, KeyLike> = new Map(); // kid -> clé (rotation)
  private currentKid: string;

  /** Clés fournies par l'environnement/KMS au démarrage (PEM). */
  async init(opts: { kid: string; privatePem: string; publicPems: Record<string, string> }) {
    this.currentKid = opts.kid;
    this.privateKey = await importPKCS8(opts.privatePem, 'EdDSA');
    for (const [kid, pem] of Object.entries(opts.publicPems)) {
      this.publicKeys.set(kid, await importSPKI(pem, 'EdDSA'));
    }
  }

  async signAccessToken(userId: string, role: string): Promise<string> {
    return new SignJWT({ role })
      .setProtectedHeader({ alg: 'EdDSA', kid: this.currentKid })
      .setSubject(userId)
      .setJti(randomBytes(16).toString('hex'))
      .setIssuer(ISSUER)
      .setAudience(AUDIENCE)
      .setIssuedAt()
      .setExpirationTime(ACCESS_TTL)
      .sign(this.privateKey);
  }

  async verifyAccessToken(token: string): Promise<AccessTokenPayload> {
    try {
      const { payload, protectedHeader } = await jwtVerify(
        token,
        async (header) => {
          const key = this.publicKeys.get(header.kid ?? '');
          if (!key) throw new Error('kid inconnu');
          return key;
        },
        { issuer: ISSUER, audience: AUDIENCE, algorithms: ['EdDSA'] },
      );
      void protectedHeader;
      return { sub: payload.sub!, role: String(payload.role), jti: String(payload.jti) };
    } catch {
      throw new UnauthorizedException({ code: 'auth/invalid_token' });
    }
  }

  /** Refresh token opaque : 256 bits d'entropie, transmis une seule fois. */
  generateRefreshToken(): { token: string; hash: string; expiresAt: Date } {
    const token = randomBytes(32).toString('base64url');
    return {
      token,
      hash: this.hashRefreshToken(token),
      expiresAt: new Date(Date.now() + REFRESH_TTL_DAYS * 24 * 3600 * 1000),
    };
  }

  /** SHA-256 suffit ici : l'entropie du token (256 bits) rend le brute force inutile. */
  hashRefreshToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }
}
