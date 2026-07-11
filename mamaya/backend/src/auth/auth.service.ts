import { randomBytes, randomUUID } from 'node:crypto';
import {
  ConflictException,
  Inject,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import type { Redis } from 'ioredis';
import { IsNull, Repository } from 'typeorm';
import { UsersService } from '../users/users.service';
import { AuthProvider, User, UserStatus } from '../users/user.entity';
import { BruteForceService, LockedError } from './brute-force.service';
import { OAuthLoginDto } from './dto/auth.dto';
import { OAuthService } from './oauth.service';
import { REDIS_CLIENT } from './redis.provider';
import { RefreshToken } from './refresh-token.entity';
import { TokenService } from './token.service';
import { TotpService } from './totp.service';

export interface TokenPair {
  accessToken: string;   // JWT EdDSA, 15 min
  refreshToken: string;  // opaque, 30 j, rotatif — à stocker dans SecureStore
}

export type LoginResult =
  | { twoFactorRequired: true; ticket: string }
  | ({ twoFactorRequired: false } & TokenPair);

const TWOFA_TICKET_TTL_S = 5 * 60;

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(RefreshToken)
    private readonly refreshTokens: Repository<RefreshToken>,
    private readonly users: UsersService,
    private readonly tokens: TokenService,
    private readonly totp: TotpService,
    private readonly oauth: OAuthService,
    private readonly bruteForce: BruteForceService,
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
  ) {}

  /** Connexion email + mot de passe. Peut exiger un second facteur. */
  async login(
    email: string,
    password: string,
    ip: string,
    deviceLabel?: string,
  ): Promise<LoginResult> {
    try {
      await this.bruteForce.assertAllowed(ip, email);
    } catch (e) {
      if (e instanceof LockedError) {
        // 429 côté controller, avec Retry-After — sans dire si le compte existe.
        throw new UnauthorizedException({ code: 'auth/locked', retryAfter: e.retryAfterS });
      }
      throw e;
    }

    let user: User;
    try {
      user = await this.users.verifyCredentials(email, password);
    } catch (e) {
      await this.bruteForce.recordFailure(ip, email);
      throw e;
    }
    await this.bruteForce.recordSuccess(email);

    if (user.totpEnabled) {
      // Ticket éphémère : le mot de passe est validé, il manque le 2ᵉ facteur.
      // Aucun token de session n'est émis avant la preuve TOTP.
      const ticket = randomBytes(32).toString('base64url');
      await this.redis.set(`2fa:${ticket}`, user.id, 'EX', TWOFA_TICKET_TTL_S);
      return { twoFactorRequired: true, ticket };
    }

    return { twoFactorRequired: false, ...(await this.issueTokens(user, deviceLabel)) };
  }

  /** Échange ticket 2FA + code TOTP (ou code de secours) → tokens. */
  async verifyTwoFactor(ticket: string, code: string): Promise<TokenPair> {
    // GETDEL : le ticket est à usage unique, même en cas d'échec du code
    // (un nouveau login redonne un ticket — évite le brute force du TOTP).
    const userId = await this.redis.getdel(`2fa:${ticket}`);
    if (!userId || !(await this.totp.verifyCode(userId, code))) {
      throw new UnauthorizedException({ code: 'auth/invalid_2fa' });
    }
    const user = await this.users.findById(userId);
    if (!user) throw new UnauthorizedException({ code: 'auth/invalid_2fa' });
    return this.issueTokens(user);
  }

  /** Connexion/inscription OAuth (Google, Apple) — token vérifié côté serveur. */
  async oauthLogin(dto: OAuthLoginDto, deviceLabel?: string): Promise<TokenPair> {
    const identity =
      dto.provider === 'google'
        ? await this.oauth.verifyGoogle(dto.idToken)
        : await this.oauth.verifyApple(dto.idToken);

    let user = await this.users.findByProvider(identity.provider, identity.sub);

    if (!user) {
      // Première connexion : l'onboarding (pseudo, statut, CGU) est requis.
      if (!dto.displayName || !dto.status || !dto.cguVersion) {
        throw new ConflictException({ code: 'auth/onboarding_required' });
      }
      user = await this.users.createFromOAuth({
        provider: identity.provider,
        providerSub: identity.sub,
        email: identity.email,
        emailVerified: identity.emailVerified,
        displayName: dto.displayName,
        status: dto.status,
        dueDate: dto.status === UserStatus.ENCEINTE ? dto.dueDate ?? null : null,
        cguVersion: dto.cguVersion,
      });
    }

    return this.issueTokens(user, deviceLabel);
  }

  /**
   * Rotation du refresh token. Détection de rejeu : un token déjà utilisé
   * ou révoqué qui se représente → révocation de TOUTE la famille (l'appareil
   * légitime devra se reconnecter, l'attaquant perd tout).
   */
  async refresh(rawToken: string): Promise<TokenPair> {
    const hash = this.tokens.hashRefreshToken(rawToken);
    const stored = await this.refreshTokens.findOneBy({ tokenHash: hash });

    if (!stored) throw new UnauthorizedException({ code: 'auth/invalid_token' });

    if (stored.usedAt || stored.revokedAt) {
      await this.revokeFamily(stored.familyId); // rejeu détecté
      throw new UnauthorizedException({ code: 'auth/token_reuse_detected' });
    }
    if (stored.expiresAt < new Date()) {
      throw new UnauthorizedException({ code: 'auth/invalid_token' });
    }

    const user = await this.users.findById(stored.userId);
    if (!user) throw new UnauthorizedException({ code: 'auth/invalid_token' });

    const next = this.tokens.generateRefreshToken();
    await this.refreshTokens.manager.transaction(async (em) => {
      await em.update(RefreshToken, stored.id, { usedAt: new Date() });
      await em.insert(RefreshToken, {
        userId: stored.userId,
        familyId: stored.familyId, // même famille : la chaîne reste traçable
        tokenHash: next.hash,
        expiresAt: next.expiresAt,
        deviceLabel: stored.deviceLabel,
      });
    });

    return {
      accessToken: await this.tokens.signAccessToken(user.id, user.role),
      refreshToken: next.token,
    };
  }

  /** Déconnexion : révoque la session courante, ou toutes (`all`). */
  async logout(userId: string, rawToken: string, all = false): Promise<void> {
    if (all) {
      await this.refreshTokens.update(
        { userId, revokedAt: IsNull() },
        { revokedAt: new Date() },
      );
      return;
    }
    const stored = await this.refreshTokens.findOneBy({
      tokenHash: this.tokens.hashRefreshToken(rawToken),
      userId, // on ne peut révoquer que ses propres tokens
    });
    if (stored) await this.revokeFamily(stored.familyId);
  }

  private async issueTokens(user: User, deviceLabel?: string): Promise<TokenPair> {
    const refresh = this.tokens.generateRefreshToken();
    await this.refreshTokens.insert({
      userId: user.id,
      familyId: randomUUID(), // nouvelle connexion = nouvelle famille
      tokenHash: refresh.hash,
      expiresAt: refresh.expiresAt,
      deviceLabel: deviceLabel ?? null,
    });
    return {
      accessToken: await this.tokens.signAccessToken(user.id, user.role),
      refreshToken: refresh.token,
    };
  }

  private async revokeFamily(familyId: string): Promise<void> {
    await this.refreshTokens.update(
      { familyId, revokedAt: IsNull() },
      { revokedAt: new Date() },
    );
  }
}
