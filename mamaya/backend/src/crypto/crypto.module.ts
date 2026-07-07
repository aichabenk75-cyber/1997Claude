import { Global, Module } from '@nestjs/common';
import { EnvelopeCryptoService, KmsClient } from './envelope-crypto.service';

/**
 * Fournit le chiffrement en enveloppe à toute l'application.
 * Le client KMS concret dépend de l'hébergeur UE retenu :
 *  - AWS eu-west-3 → @aws-sdk/client-kms (GenerateDataKey / Decrypt)
 *  - Scaleway → Key Manager (API compatible)
 * En dev/local : clé maîtresse fichier via l'implémentation LocalKms ci-dessous.
 */
class LocalDevKms implements KmsClient {
  // ⚠️ DEV UNIQUEMENT — la « clé maîtresse » vient d'une variable d'environnement.
  private readonly master = Buffer.from(process.env.DEV_MASTER_KEY ?? '', 'base64');

  async generateDataKey() {
    const { randomBytes, createCipheriv } = await import('node:crypto');
    const plaintext = randomBytes(32);
    const nonce = randomBytes(12);
    const cipher = createCipheriv('aes-256-gcm', this.master, nonce);
    const data = Buffer.concat([cipher.update(plaintext), cipher.final()]);
    return { plaintext, encrypted: Buffer.concat([nonce, cipher.getAuthTag(), data]) };
  }

  async decryptDataKey(encrypted: Buffer) {
    const { createDecipheriv } = await import('node:crypto');
    const nonce = encrypted.subarray(0, 12);
    const tag = encrypted.subarray(12, 28);
    const data = encrypted.subarray(28);
    const decipher = createDecipheriv('aes-256-gcm', this.master, nonce);
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(data), decipher.final()]);
  }
}

@Global()
@Module({
  providers: [
    {
      provide: EnvelopeCryptoService,
      useFactory: () => new EnvelopeCryptoService(new LocalDevKms()),
    },
  ],
  exports: [EnvelopeCryptoService],
})
export class CryptoModule {}
