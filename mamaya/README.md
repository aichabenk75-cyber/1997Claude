# Mamaya 🤱

Réseau social dédié aux mères et futures mères (expérience type WeMoms).
Piliers : **sécurité**, **confidentialité (RGPD)**, **bienveillance de la communauté**.

> ⚠️ Projet **indépendant** du reste du dépôt (fichiers ML Academy à la racine) —
> tout Mamaya vit dans ce dossier `mamaya/`.

## Démarche (itérative, validée étape par étape)

| Étape | Livrable | Statut |
|---|---|---|
| 1 | Architecture technique & stack — [`docs/ETAPE-1-ARCHITECTURE.md`](docs/ETAPE-1-ARCHITECTURE.md) | ✅ Validé |
| 2 | Modélisation base de données — [`docs/ETAPE-2-BASE-DE-DONNEES.md`](docs/ETAPE-2-BASE-DE-DONNEES.md) | ✅ Validé |
| 3 | Spécification de l'API — [`docs/ETAPE-3-API.md`](docs/ETAPE-3-API.md) | ✅ Livré |
| 4 | Protocoles de sécurité — [`docs/ETAPE-4-SECURITE.md`](docs/ETAPE-4-SECURITE.md) | ✅ Livré |
| 5 | Code core — [`docs/ETAPE-5-CODE-CORE.md`](docs/ETAPE-5-CODE-CORE.md) · `backend/` · `mobile/` | ✅ Livré |

## Chantier V1 (briques post-plan)

| Brique | Livrable | Statut |
|---|---|---|
| 1 | Module auth complet — [`docs/MODULE-AUTH.md`](docs/MODULE-AUTH.md) · `backend/src/auth/` | ✅ Livré |
| 2 | Migrations SQL — [`backend/migrations/0001_init.sql`](backend/migrations/0001_init.sql) | ✅ Livré |
| 3 | Module feed + pipeline de modération (blocklist → IA → revue humaine) | ⏳ |
| 4 | Gateway WebSocket chat (Socket.IO + Redis, messages chiffrés) | ⏳ |
| 5 | CI GitHub Actions + conteneurisation | ⏳ |

## Stack proposée (résumé)

- **Mobile** : React Native + Expo (TypeScript)
- **Backend** : Node.js + NestJS — REST `/v1` + WebSocket (Socket.IO)
- **Données** : PostgreSQL 16 + PostGIS · Redis 7 · S3 UE + CDN
- **Sécurité** : TLS 1.3, AES-256-GCM en enveloppe (KMS), Argon2id, JWT courts + refresh rotatifs, 2FA TOTP, rate limiting Redis
- **RGPD** : hébergement UE, consentements en base, suppression en un clic + purge J+30, crypto-shredding
