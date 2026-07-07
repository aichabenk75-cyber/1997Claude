import { createHash, randomBytes } from 'node:crypto';
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { authenticator } from 'otplib';
import { DataSource } from 'typeorm';
import { EnvelopeCryptoService } from '../crypto/envelope-crypto.service';
import { User } from '../users/user.entity';

const BACKUP_CODES_COUNT = 10;

/**
 * 2FA TOTP (RFC 6238), optionnelle.
 * Le secret est une donnée P0 : chiffré en enveloppe, jamais reloggé.
 * Les codes de secours sont affichés UNE fois, stockés hachés, à usage unique.
 */
@Injectable()
export class TotpService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly crypto: EnvelopeCryptoService,
  ) {}

  /** Étape 1 : génère le secret + l'URL otpauth (QR code) + les codes de secours. */
  async startEnrollment(userId: string, email: string) {
    const secret = authenticator.generateSecret(20);
    const secretEnc = await this.crypto.encryptForUser(userId, 'totp.secret', secret);

    const backupCodes = Array.from({ length: BACKUP_CODES_COUNT }, () =>
      randomBytes(5).toString('hex'), // 10 caractères hexa, lisibles
    );

    await this.dataSource.transaction(async (em) => {
      // totpEnabled reste false tant que l'enrôlement n'est pas confirmé.
      await em.update(User, userId, { totpSecretEnc: secretEnc });
      await em.getRepository('totp_backup_codes').delete({ userId });
      await em.getRepository('totp_backup_codes').insert(
        backupCodes.map((code) => ({ userId, codeHash: this.hash(code) })),
      );
    });

    return {
      otpauthUrl: authenticator.keyuri(email, 'Mamaya', secret),
      backupCodes, // seule et unique fois où ils transitent en clair
    };
  }

  /** Étape 2 : l'utilisatrice prouve que son app TOTP fonctionne → activation. */
  async confirmEnrollment(userId: string, code: string): Promise<void> {
    if (!(await this.verifyCode(userId, code))) {
      throw new UnauthorizedException({ code: 'auth/invalid_totp' });
    }
    await this.dataSource.getRepository(User).update(userId, { totpEnabled: true });
  }

  /** Vérifie un code TOTP, ou un code de secours (consommé à l'usage). */
  async verifyCode(userId: string, code: string): Promise<boolean> {
    const normalized = code.replace(/\s+/g, '');

    // Code de secours ? (10 hexa) — consommation atomique, usage unique.
    if (/^[0-9a-f]{10}$/i.test(normalized)) {
      const consumed = await this.dataSource.query(
        `UPDATE totp_backup_codes SET used_at = now()
         WHERE user_id = $1 AND code_hash = $2 AND used_at IS NULL
         RETURNING user_id`,
        [userId, this.hash(normalized.toLowerCase())],
      );
      return consumed.length > 0;
    }

    const user = await this.dataSource
      .getRepository(User)
      .createQueryBuilder('u')
      .addSelect('u.totpSecretEnc')
      .where('u.id = :userId', { userId })
      .getOne();
    if (!user?.totpSecretEnc) return false;

    const secret = (
      await this.crypto.decryptForUser(userId, 'totp.secret', user.totpSecretEnc)
    ).toString('utf8');
    // Fenêtre ±1 pas (30 s) pour tolérer la dérive d'horloge du téléphone.
    return authenticator.verify({ token: normalized, secret });
  }

  /** Désactivation (le mot de passe a déjà été revérifié par le controller). */
  async disable(userId: string): Promise<void> {
    await this.dataSource.transaction(async (em) => {
      await em.update(User, userId, { totpEnabled: false, totpSecretEnc: null });
      await em.getRepository('totp_backup_codes').delete({ userId });
    });
  }

  private hash(v: string): string {
    return createHash('sha256').update(v).digest('hex');
  }
}
