import { Injectable } from '@nestjs/common';
import {
  createCipheriv,
  createDecipheriv,
  randomBytes,
} from 'node:crypto';

/**
 * Abstraction du KMS (AWS KMS, Scaleway Key Manager, Vault Transit…).
 * La clé maîtresse ne quitte JAMAIS le KMS : on lui délègue uniquement
 * la génération et le déchiffrement des DEK (clés de données).
 */
export interface KmsClient {
  /** Génère une DEK 256 bits : renvoie le clair (usage immédiat) + la version chiffrée (EDK, à persister). */
  generateDataKey(): Promise<{ plaintext: Buffer; encrypted: Buffer }>;
  /** Déchiffre une EDK persistée → DEK en clair (en mémoire seulement). */
  decryptDataKey(encrypted: Buffer): Promise<Buffer>;
  /** Détruit définitivement une EDK côté stockage → crypto-shredding. */
}

const ALG = 'aes-256-gcm';
const NONCE_LEN = 12; // 96 bits — recommandé pour GCM
const TAG_LEN = 16;
const DEK_CACHE_TTL_MS = 5 * 60 * 1000;

/**
 * Chiffrement en enveloppe des données P0 (messages, prénoms/dates de
 * naissance des enfants, secrets TOTP, position).
 *
 * Format du ciphertext stocké (bytea) : nonce(12) ‖ tag(16) ‖ data.
 * L'AAD lie chaque ciphertext à son propriétaire et à son champ :
 * un blob déplacé vers une autre ligne/colonne ne se déchiffre pas.
 */
@Injectable()
export class EnvelopeCryptoService {
  // Cache mémoire court des DEK déchiffrées — jamais Redis, jamais disque.
  private readonly dekCache = new Map<string, { key: Buffer; expiresAt: number }>();

  constructor(private readonly kms: KmsClient) {}

  async encryptForUser(
    userId: string,
    field: string,
    plaintext: string | Buffer,
  ): Promise<Buffer> {
    const dek = await this.getDek(userId);
    const nonce = randomBytes(NONCE_LEN); // unique par chiffrement, jamais réutilisé
    const cipher = createCipheriv(ALG, dek, nonce);
    cipher.setAAD(this.aad(userId, field));
    const data = Buffer.concat([
      cipher.update(typeof plaintext === 'string' ? Buffer.from(plaintext, 'utf8') : plaintext),
      cipher.final(),
    ]);
    return Buffer.concat([nonce, cipher.getAuthTag(), data]);
  }

  async decryptForUser(userId: string, field: string, blob: Buffer): Promise<Buffer> {
    const dek = await this.getDek(userId);
    const nonce = blob.subarray(0, NONCE_LEN);
    const tag = blob.subarray(NONCE_LEN, NONCE_LEN + TAG_LEN);
    const data = blob.subarray(NONCE_LEN + TAG_LEN);
    const decipher = createDecipheriv(ALG, dek, nonce);
    decipher.setAAD(this.aad(userId, field));
    decipher.setAuthTag(tag);
    // Toute altération (donnée, AAD, tag) lève ici — intégrité garantie par GCM.
    return Buffer.concat([decipher.update(data), decipher.final()]);
  }

  /** À appeler lors de la purge RGPD, après destruction de l'EDK en base. */
  evictUser(userId: string): void {
    this.dekCache.delete(userId);
  }

  private aad(userId: string, field: string): Buffer {
    return Buffer.from(`mamaya:v1:${userId}:${field}`, 'utf8');
  }

  private async getDek(userId: string): Promise<Buffer> {
    const hit = this.dekCache.get(userId);
    if (hit && hit.expiresAt > Date.now()) return hit.key;

    const edk = await this.loadOrCreateEdk(userId);
    const key = await this.kms.decryptDataKey(edk);
    this.dekCache.set(userId, { key, expiresAt: Date.now() + DEK_CACHE_TTL_MS });
    return key;
  }

  /**
   * Charge l'EDK de l'utilisatrice depuis la table user_keys, ou en crée une
   * (INSERT … ON CONFLICT DO NOTHING pour rester idempotent en concurrence).
   * Implémentation du repository omise ici — voir module `keys`.
   */
  private async loadOrCreateEdk(userId: string): Promise<Buffer> {
    throw new Error('Brancher le repository user_keys (module keys).');
  }
}
