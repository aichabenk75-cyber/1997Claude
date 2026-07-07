# Mamaya — Briques V1 n°3 et n°4 : Feed/Modération et Chat

## Brique 3 — Feed + modération (`backend/src/feed/`, `backend/src/moderation/`)

### Feed
- **Deux modes** : `algo` (score `engagement pondéré / décroissance temporelle` sur 14 jours, filtré intérêts + stade + follows) et `chrono` (antéchronologique pur). Pagination keyset dans les deux cas — jamais d'OFFSET, curseur opaque base64.
- **Structurel, pas optionnel** : seuls les contenus `approuve` sortent (index partiel), blocages exclus bilatéralement dans le SQL.
- Création de post (texte/photos/sondage) → transaction + envoi en file `moderation` ; le contenu reste visible par l'autrice seule tant qu'il est `en_attente`.
- `audienceStage` calculé en granularité grossière (trimestre, tranche d'âge) — cf. Étape 4.

### Pipeline de modération (BullMQ, hors requête)
```
contenu créé ──▶ ① blocklist regex (severity 'bloquer' → rejeté net)
             ──▶ ② classification IA (Claude API) texte + photos
             ──▶ ③ verdict écrit + tracé dans moderation_actions
```
- **`ModerationAiService`** : `claude-opus-4-8` avec **structured outputs** (schéma JSON strict : `verdict`/`categories`/`raison`) — pas de parsing fragile ; prompt système mis en **cache** (appels fréquents, ~90 % d'économie) ; refus du modèle ou erreur API → **revue humaine, jamais d'approbation automatique** (fail-safe).
- Le prompt distingue explicitement les discussions crues mais légitimes entre mères (allaitement, corps, post-partum) des contenus réellement problématiques — « dans le doute → revue humaine, jamais rejet ».
- Back-office : file de revue (`GET /v1/mod/queue`), décisions tracées, signalements 20/jour, blocages.

## Brique 4 — Chat WebSocket (`backend/src/chat/`)

- **DM idempotent** : `dm_key = sha256(paire d'ids triée)` → impossible de créer deux DM pour la même paire. Un blocage entre deux personnes renvoie le même 404 qu'un compte inexistant (non révélé).
- **Chiffrement** : chaque message est chiffré en enveloppe avec la DEK de l'expéditrice avant insertion ; l'historique est déchiffré à la volée, uniquement pour les membres de la conversation.
- **Gateway Socket.IO** (`/chat`) : JWT vérifié au handshake (clé publique seule), rooms `conv:<id>` et `user:<id>`, `message:send` avec ack `clientId` (UI optimiste), `typing:*` éphémère jamais persisté, accusés de lecture. L'**adapter Redis** (branché dans `main.ts`) permet N instances.
- **Hors-ligne** : job `push` (FCM/APNs) — le payload push ne contient jamais le texte du message, seulement l'id + deep link.
- REST : liste des conversations, annuaire des groupes publics, historique paginé, fallback d'envoi throttlé 60/min.

## Brique 5 — Socle exécutable

- `app.module.ts` : validation stricte globale (`whitelist + forbidNonWhitelisted`), throttler global 60/min, TypeORM (jamais de `synchronize` — le schéma vient de `migrations/0001_init.sql`), BullMQ.
- `main.ts` : helmet, versioning `/v1`, initialisation des clés EdDSA, adapter Redis Socket.IO.
- `crypto.module.ts` : factory KMS (implémentation locale pour le dev, à remplacer par AWS KMS/Scaleway en prod).
- `Dockerfile` multi-stage non-root + `docker-compose.yml` (PostGIS 16, Redis 7, migration auto-appliquée au premier démarrage).
- CI GitHub Actions : typecheck + lint + tests + build + scan de dépendances.
