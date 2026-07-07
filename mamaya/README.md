# Mamaya 🤱

Réseau social dédié aux mères et futures mères (expérience type WeMoms).
Piliers : **sécurité**, **confidentialité (RGPD)**, **bienveillance de la communauté**.

> ⚠️ Projet **indépendant** du reste du dépôt (fichiers ML Academy à la racine) —
> tout Mamaya vit dans ce dossier `mamaya/`.

## Démarche (itérative, validée étape par étape)

| Étape | Livrable | Statut |
|---|---|---|
| 1 | Architecture technique & stack — [`docs/ETAPE-1-ARCHITECTURE.md`](docs/ETAPE-1-ARCHITECTURE.md) | ✅ Proposé — en attente de validation |
| 2 | Modélisation base de données — [`docs/ETAPE-2-BASE-DE-DONNEES.md`](docs/ETAPE-2-BASE-DE-DONNEES.md) | ✅ Proposé — en attente de validation |
| 3 | Spécification de l'API (endpoints REST + WebSocket) | ⏳ Après validation 1-2 |
| 4 | Protocoles de sécurité (géoloc, données santé/enfants) | ⏳ Après validation 1-2 |
| 5 | Code core (modèle Utilisateur backend, carte React Native + Mode Fantôme) | ⏳ Après validation 1-2 |

## Stack proposée (résumé)

- **Mobile** : React Native + Expo (TypeScript)
- **Backend** : Node.js + NestJS — REST `/v1` + WebSocket (Socket.IO)
- **Données** : PostgreSQL 16 + PostGIS · Redis 7 · S3 UE + CDN
- **Sécurité** : TLS 1.3, AES-256-GCM en enveloppe (KMS), Argon2id, JWT courts + refresh rotatifs, 2FA TOTP, rate limiting Redis
- **RGPD** : hébergement UE, consentements en base, suppression en un clic + purge J+30, crypto-shredding
