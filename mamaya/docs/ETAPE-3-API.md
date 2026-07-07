# Mamaya — Étape 3 : Spécification de l'API

> REST versionnée sous `/v1` (JSON) + une gateway WebSocket pour le temps réel.
> Toutes les routes sont servies en **HTTPS/TLS 1.3** uniquement.
> Statut : validé sur la base de la stack et du schéma des Étapes 1-2.

---

## 0. Conventions transverses

- **Auth** : `Authorization: Bearer <JWT accès 15 min>`. Renouvellement via refresh token rotatif. Les routes marquées 🔓 sont publiques, toutes les autres exigent un JWT valide.
- **Pagination** : par curseur — `?cursor=<opaque>&limit=20` → réponse `{ data: [...], next_cursor: "..." | null }`. Jamais d'`OFFSET`.
- **Erreurs** : format unique `{ "error": { "code": "auth/invalid_credentials", "message": "…" } }` + statut HTTP adapté. Messages volontairement non-informatifs sur l'existence d'un compte (anti-énumération).
- **Rate limiting** (Redis, fenêtre glissante) : défaut **60 req/min/utilisatrice** ; limites renforcées indiquées ⏱ par endpoint. Réponse `429` + `Retry-After`.
- **Validation** : chaque body passe par un DTO `class-validator` (whitelist stricte : champ inconnu → `400`).
- **Idempotence** : `Idempotency-Key` accepté sur tous les POST de création.

---

## 1. Auth & session

| Méthode | Route | Description |
|---|---|---|
| POST 🔓 | `/v1/auth/register` | Inscription email + mot de passe. ⏱ 5/h/IP. Envoie l'email de vérification. |
| POST 🔓 | `/v1/auth/login` | Connexion. ⏱ 10/15 min/IP + verrouillage progressif par compte. Si 2FA actif → réponse `{ "2fa_required": true, "ticket": "…" }`. |
| POST 🔓 | `/v1/auth/2fa/verify` | Échange `ticket` + code TOTP → tokens. ⏱ 5/5 min. |
| POST 🔓 | `/v1/auth/oauth/google` · `/v1/auth/oauth/apple` | Échange du token OAuth natif (vérifié côté serveur) → création/connexion du compte. |
| POST 🔓 | `/v1/auth/refresh` | Rotation du refresh token (l'ancien est révoqué ; réutilisation détectée → révocation de toute la famille). |
| POST | `/v1/auth/logout` | Révoque le refresh token courant (ou tous avec `{"all": true}`). |
| POST 🔓 | `/v1/auth/password/forgot` → `/v1/auth/password/reset` | Réinitialisation par lien à usage unique. ⏱ 3/h/IP. |
| POST | `/v1/auth/2fa/enable` → `/v1/auth/2fa/confirm` | Activation TOTP (QR code + codes de secours). |
| DELETE | `/v1/auth/2fa` | Désactivation (mot de passe requis). |

## 2. Profil, enfants, RGPD

| Méthode | Route | Description |
|---|---|---|
| GET / PATCH | `/v1/me` | Mon compte + profil (statut, date de terme, pseudo, bio, avatar, ville). |
| GET | `/v1/users/:id` | Profil **public** d'une autre maman (pseudo, avatar, badges, stade approximatif — jamais d'email ni de date exacte). |
| POST / PATCH / DELETE | `/v1/me/children` · `/v1/me/children/:id` | Enfants (prénom + date de naissance → chiffrés côté serveur, cf. Étape 4). |
| GET / PUT | `/v1/me/interests` | Centres d'intérêt (liste de slugs). |
| GET | `/v1/me/badges` | Badges gagnés. |
| GET / PUT | `/v1/me/consents` | Consentements (géoloc, notifications, analytics) — opt-in explicite, révocable. |
| POST | `/v1/me/avatar/upload-url` | URL S3 présignée (l'API ne reçoit jamais les octets). |
| GET | `/v1/me/export` | **Portabilité RGPD** : génère une archive JSON complète (job async → notification quand prête). ⏱ 1/jour. |
| DELETE | `/v1/me` | **Suppression en un clic** : soft delete immédiat (compte invisible, sessions révoquées) + purge définitive J+30. Annulable via `POST /v1/me/restore` pendant 30 j. |

## 3. Feed & posts

| Méthode | Route | Description |
|---|---|---|
| GET | `/v1/feed?mode=algo\|chrono` | Fil d'actualité. `algo` (défaut) : score récence × engagement, filtré par intérêts + stade ; `chrono` : antéchronologique pur. Curseur. |
| GET | `/v1/categories` 🔓 | Catégories (Allaitement, Sommeil, …). |
| POST | `/v1/posts` | Créer un post (texte, photos via URLs S3 présignées, ou sondage `{question, options[]}`). Passe en modération (`en_attente`) avant amplification. ⏱ 10/h. |
| GET / DELETE | `/v1/posts/:id` | Détail / suppression (autrice ou modération). |
| GET | `/v1/posts/:id/comments` | Commentaires paginés (+ réponses de 1er niveau). |
| POST | `/v1/posts/:id/comments` | Commenter (`parent_id` optionnel). ⏱ 30/h. |
| PUT / DELETE | `/v1/posts/:id/reactions` · idem `/v1/comments/:id/reactions` | Ajouter/retirer un « soutien » (idempotent). |
| POST | `/v1/posts/:id/votes` | Voter à un sondage `{option_id}` (1 voix, modifiable tant que le sondage est ouvert). |
| POST | `/v1/posts/:id/share` | Partage (compteur + deep link). |
| GET | `/v1/tags/:slug/posts` | Posts d'un tag. |
| POST / DELETE | `/v1/users/:id/follow` | Suivre / ne plus suivre. |

## 4. Géolocalisation — « Mamans autour de moi »

| Méthode | Route | Description |
|---|---|---|
| PUT | `/v1/me/location` | Le mobile envoie `{lat, lng}` ; le serveur vérifie le **consentement géoloc**, floute (~1 km) et upsert. **404 logique si consentement absent.** ⏱ 6/h (aucune raison légitime d'aller plus vite). |
| DELETE | `/v1/me/location` | Efface immédiatement ma position (ligne supprimée, pas seulement masquée). |
| PATCH | `/v1/me/location/ghost-mode` | `{enabled: true|false}` — **Mode Fantôme** : effet immédiat (sortie de l'index de recherche). |
| GET | `/v1/nearby?radius_km=10&child_age=0-6m&interests=allaitement,sommeil` | Mamans autour de moi : renvoie **uniquement** `{user_id, display_name, avatar_url, distance_km (arrondie), zone_label}` — **jamais de coordonnées**. Résultats vides si moins de 5 profils dans la zone (k-anonymat, cf. Étape 4). ⏱ 20/h. |

## 5. Chat (REST + WebSocket)

REST (historique, gestion) :

| Méthode | Route | Description |
|---|---|---|
| GET | `/v1/conversations` | Mes conversations (dernier message déchiffré, non-lus). |
| POST | `/v1/conversations` | Créer : `{type:'dm', user_id}` (idempotent via `dm_key`) ou `{type:'groupe_prive'|'groupe_public', title, …}`. |
| GET | `/v1/conversations/discover?q=paris` | Annuaire des groupes **publics**. |
| POST / DELETE | `/v1/conversations/:id/members` | Rejoindre un groupe public / inviter (groupe privé, admin) / quitter. |
| GET | `/v1/conversations/:id/messages` | Historique paginé (déchiffré à la volée, autorisation = être membre). |
| POST | `/v1/conversations/:id/messages` | Envoi (fallback REST si WS indisponible). ⏱ 60/min. |
| POST | `/v1/conversations/:id/read` | Marquer lu (`last_read_at`). |
| PATCH | `/v1/conversations/:id` | Titre/avatar/mute (droits admin pour les groupes). |

WebSocket `wss://…/chat` (auth par JWT au handshake, reconnexion avec reprise par curseur) :

| Sens | Événement | Payload |
|---|---|---|
| ⬆ client | `message:send` | `{conversation_id, client_id, body, media_key?}` → ack `{id, created_at}` |
| ⬇ serveur | `message:new` | message complet (poussé à tous les membres connectés) |
| ⬆ client | `typing:start` / `typing:stop` | `{conversation_id}` (throttlé, éphémère — jamais persisté) |
| ⬇ serveur | `conversation:read` | `{conversation_id, user_id, last_read_at}` |
| ⬇ serveur | `notification:new` | compteur/badge en temps réel |

Hors connexion → **push FCM/APNs** (contenu du message **jamais dans le payload push** : seulement « Nouveau message de … » + deep link).

## 6. Notifications & appareils

| Méthode | Route | Description |
|---|---|---|
| POST / DELETE | `/v1/me/devices` | Enregistrer / retirer un token push. |
| GET | `/v1/me/notifications` | Centre de notifications paginé. |
| POST | `/v1/me/notifications/read` | Tout marquer lu (ou `{ids: []}`). |
| GET / PUT | `/v1/me/notification-settings` | Préférences fines par type (opt-in). |

## 7. Modération & sûreté

| Méthode | Route | Description |
|---|---|---|
| POST | `/v1/reports` | Signalement : `{target_type: post\|comment\|user\|message, target_id, reason, details?}`. ⏱ 20/jour. |
| POST / DELETE | `/v1/users/:id/block` | Bloquer / débloquer (retire réciproquement des feeds, du nearby et du chat). |
| GET | `/v1/me/blocks` | Ma liste de blocages. |

Back-office (rôle `moderator`/`admin`, périmètre séparé + audit systématique) :

| Méthode | Route | Description |
|---|---|---|
| GET | `/v1/mod/queue` | File : signalements ouverts + contenus `revue_humaine` (score IA joint). |
| POST | `/v1/mod/decisions` | `{target_type, target_id, action: approuve\|rejete\|avertissement\|ban_7j\|ban_definitif, reason}` → tracé dans `moderation_actions`. |
| GET / POST / DELETE | `/v1/mod/banned-words` | Gestion de la blocklist. |

**Pipeline de modération automatique** (job BullMQ, hors requête) : ① blocklist (regex) — sévérité `bloquer` → rejet immédiat ; ② classification IA (Claude API) du texte/de l'image → `approuve` si score sûr, `revue_humaine` sinon ; ③ un contenu `en_attente` reste visible par son autrice seulement (pas d'amplification avant approbation).
