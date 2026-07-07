import { createHash } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import type { Redis } from 'ioredis';

/**
 * Anti-brute-force (Étape 4) — compteurs Redis, en dehors de la base :
 *  - par IP : 10 essais / 15 min ;
 *  - par compte : verrouillage progressif 1 min → 15 min → 1 h.
 * Les clés utilisent des HACHÉS (IP, email) : Redis ne contient pas de PII
 * en clair. Le résultat est identique que le compte existe ou non
 * (anti-énumération).
 */
const IP_MAX_ATTEMPTS = 10;
const IP_WINDOW_S = 15 * 60;
const ACCOUNT_LOCK_STEPS_S = [60, 15 * 60, 60 * 60]; // paliers progressifs
const ACCOUNT_FAILURES_PER_STEP = 5;
const FAILURE_MEMORY_S = 60 * 60; // fenêtre d'escalade

export class LockedError extends Error {
  constructor(public readonly retryAfterS: number) {
    super('auth/locked');
  }
}

@Injectable()
export class BruteForceService {
  constructor(private readonly redis: Redis) {}

  /** À appeler AVANT toute vérification de mot de passe. Lève LockedError si bloqué. */
  async assertAllowed(ip: string, email: string): Promise<void> {
    const [ipCount, lockTtl] = await Promise.all([
      this.redis.get(this.ipKey(ip)),
      this.redis.ttl(this.lockKey(email)),
    ]);
    if (lockTtl > 0) throw new LockedError(lockTtl);
    if (ipCount !== null && Number(ipCount) >= IP_MAX_ATTEMPTS) {
      throw new LockedError(IP_WINDOW_S);
    }
  }

  /** À appeler après un échec d'authentification. */
  async recordFailure(ip: string, email: string): Promise<void> {
    const ipKey = this.ipKey(ip);
    const failKey = this.failKey(email);

    const [, , failures] = await this.redis
      .multi()
      .incr(ipKey)
      .expire(ipKey, IP_WINDOW_S, 'NX')
      .incr(failKey)
      .expire(failKey, FAILURE_MEMORY_S, 'NX')
      .exec()
      .then((r) => [null, null, Number(r?.[2]?.[1] ?? 0)] as const);

    if (failures > 0 && failures % ACCOUNT_FAILURES_PER_STEP === 0) {
      const step = Math.min(
        failures / ACCOUNT_FAILURES_PER_STEP - 1,
        ACCOUNT_LOCK_STEPS_S.length - 1,
      );
      await this.redis.set(this.lockKey(email), '1', 'EX', ACCOUNT_LOCK_STEPS_S[step]);
    }
  }

  /** À appeler après un succès : efface l'ardoise du compte (pas celle de l'IP). */
  async recordSuccess(email: string): Promise<void> {
    await this.redis.del(this.failKey(email), this.lockKey(email));
  }

  private ipKey(ip: string) {
    return `bf:ip:${this.h(ip)}`;
  }
  private failKey(email: string) {
    return `bf:fail:${this.h(email.toLowerCase())}`;
  }
  private lockKey(email: string) {
    return `bf:lock:${this.h(email.toLowerCase())}`;
  }
  private h(v: string) {
    return createHash('sha256').update(v).digest('hex').slice(0, 32);
  }
}
