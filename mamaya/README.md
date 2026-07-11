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
| 3 | Module feed + pipeline de modération — [`docs/MODULES-FEED-CHAT.md`](docs/MODULES-FEED-CHAT.md) · `backend/src/feed/` · `backend/src/moderation/` | ✅ Livré |
| 4 | Gateway WebSocket chat — `backend/src/chat/` | ✅ Livré |
| 5 | Socle exécutable + Docker + CI — `backend/` · [`docker-compose.yml`](docker-compose.yml) | ✅ Livré |
| 6 | App mobile Expo (auth, fil, chat, carte, profil) — `mobile/` | ✅ Livré |

## Démarrage local (backend)

```bash
cd mamaya
./scripts/gen-dev-env.sh   # génère .env (secrets de DEV : clés JWT, master key…)
docker compose up --build  # API sur :3000, PostGIS, Redis, migrations auto
```

Sans `ANTHROPIC_API_KEY`, la modération auto-approuve les contenus
(`MODERATION_DEV_AUTO_APPROVE=true`, défaut du compose) pour que le feed vive en dev.

## Tester l'app sur ton téléphone (Expo Go) 📱

1. **Installe Expo Go** sur ton téléphone (App Store / Play Store).
2. **Lance le backend** (section ci-dessus) sur ton ordinateur.
3. **Trouve l'IP locale de ton ordinateur** (même Wi-Fi que le téléphone) :
   - macOS : `ipconfig getifaddr en0` · Linux : `hostname -I` · Windows : `ipconfig`
4. **Configure et démarre l'app** :

   ```bash
   cd mamaya/mobile
   cp .env.example .env       # puis mets TON IP : EXPO_PUBLIC_API_URL=http://192.168.x.x:3000
   npm install
   npx expo start
   ```

5. **Scanne le QR code** affiché dans le terminal avec Expo Go (Android) ou
   l'appareil photo (iPhone). L'app s'ouvre → crée ton compte et explore 💛

> Simulateur iOS : `EXPO_PUBLIC_API_URL=http://localhost:3000` ·
> Émulateur Android : `http://10.0.2.2:3000`.
> Si Expo Go réclame un SDK plus récent : `npx expo install expo@latest --fix`.

## Stack proposée (résumé)

- **Mobile** : React Native + Expo (TypeScript)
- **Backend** : Node.js + NestJS — REST `/v1` + WebSocket (Socket.IO)
- **Données** : PostgreSQL 16 + PostGIS · Redis 7 · S3 UE + CDN
- **Sécurité** : TLS 1.3, AES-256-GCM en enveloppe (KMS), Argon2id, JWT courts + refresh rotatifs, 2FA TOTP, rate limiting Redis
- **RGPD** : hébergement UE, consentements en base, suppression en un clic + purge J+30, crypto-shredding
