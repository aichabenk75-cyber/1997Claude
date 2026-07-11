#!/usr/bin/env node
/**
 * Génère backend/.env pour un lancement SANS Docker (Neon + Upstash + npm run start).
 * Ne touche jamais DATABASE_URL / REDIS_URL — l'utilisateur les colle lui-même
 * (copiées depuis les tableaux de bord Neon / Upstash).
 * Cross-platform (Node pur) : pas besoin d'OpenSSL ni de PowerShell.
 */
const { generateKeyPairSync, randomBytes } = require('node:crypto');
const { writeFileSync, existsSync } = require('node:fs');
const path = require('node:path');

const envPath = path.join(__dirname, '..', '.env');

if (existsSync(envPath)) {
  console.error('⚠️  .env existe déjà — supprime-le d’abord si tu veux le régénérer.');
  process.exit(1);
}

const { privateKey, publicKey } = generateKeyPairSync('ed25519');
const privatePem = privateKey.export({ type: 'pkcs8', format: 'pem' }).toString().trim();
const publicPem = publicKey.export({ type: 'spki', format: 'pem' }).toString().trim();

// dotenv lit les `\n` littéraux dans une valeur entre guillemets comme de vrais retours à la ligne.
const esc = (pem) => pem.replace(/\r?\n/g, '\\n');

const env = `# Backend Mamaya — configuration générée automatiquement (secrets de DEV uniquement).
# Colle ci-dessous les URLs copiées depuis Neon (Postgres) et Upstash (Redis) :
DATABASE_URL=
REDIS_URL=

DEV_MASTER_KEY=${randomBytes(32).toString('base64')}
GEO_JITTER_SECRET=${randomBytes(32).toString('hex')}

JWT_KID=k1
JWT_PRIVATE_PEM="${esc(privatePem)}"
JWT_PUBLIC_PEM="${esc(publicPem)}"

ANTHROPIC_API_KEY=
MODERATION_DEV_AUTO_APPROVE=true

PORT=3000
`;

writeFileSync(envPath, env, { mode: 0o600 });
console.log('✅ backend/.env créé.');
console.log('   → Ouvre ce fichier et colle tes URLs DATABASE_URL et REDIS_URL (Neon / Upstash).');
