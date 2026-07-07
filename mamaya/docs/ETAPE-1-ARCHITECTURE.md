# Mamaya — Étape 1 : Architecture technique & Stack

> Réseau social pour mères et futures mères (expérience type WeMoms).
> Piliers : **sécurité**, **confidentialité (RGPD)**, **bienveillance**.
> Statut : proposition CTO — à valider avant l'Étape 3.

---

## 1. Vue d'ensemble

```
                        ┌──────────────────────────────┐
                        │   Apps mobiles (iOS/Android) │
                        │   React Native + Expo (TS)   │
                        └──────────────┬───────────────┘
                                       │ HTTPS (TLS 1.3) + WSS
                        ┌──────────────▼───────────────┐
                        │        API Gateway / LB       │
                        │  (rate limiting, WAF, CORS)   │
                        └───────┬──────────────┬────────┘
                                │              │
                 ┌──────────────▼───┐   ┌──────▼──────────────┐
                 │  API NestJS      │   │  Gateway WebSocket  │
                 │  (REST, stateless│   │  (chat, présence,   │
                 │   scalable N×)   │   │   notifications)    │
                 └───┬────┬────┬────┘   └──────┬──────────────┘
                     │    │    │               │
      ┌──────────────▼┐ ┌─▼────▼───┐   ┌──────▼──────┐
      │ PostgreSQL 16 │ │  Redis   │   │   BullMQ    │
      │ + PostGIS     │ │ cache /  │   │ jobs async: │
      │ (données      │ │ pub-sub /│   │ modération  │
      │  relationnelles│ │ rate-   │   │ IA, push,   │
      │  + géo)       │ │ limit    │   │ emails, RGPD│
      └───────────────┘ └──────────┘   └──────┬──────┘
                                              │
                    ┌─────────────────────────▼──────────┐
                    │ Services externes : FCM/APNs (push)│
                    │ S3 UE + CDN (médias) · KMS (clés)  │
                    │ API IA de modération (Claude API)  │
                    └────────────────────────────────────┘
```

Monolithe modulaire NestJS au départ (un module par domaine : `auth`, `users`, `feed`, `chat`, `geo`, `moderation`), découpable en microservices plus tard **sans réécriture** : les modules NestJS communiquent déjà par interfaces et events.

---

## 2. Stack retenue et justifications

### 2.1 Mobile — **React Native + Expo (TypeScript)**

| Choix | Justification |
|---|---|
| React Native | Une seule base de code iOS + Android — critique pour une petite équipe. Écosystème énorme (cartes, chat, push). |
| Expo (workflow managé + EAS) | Builds cloud, mises à jour OTA (corrections sans passer par les stores), modules natifs prêts : `expo-notifications`, `expo-location`, `expo-secure-store`, `expo-local-authentication` (biométrie pour le 2FA). |
| TypeScript de bout en bout | Les types (DTO) sont **partagés entre le backend et le mobile** via un package commun → moins de bugs d'intégration API. |
| TanStack Query + Zustand | Cache réseau + état local simples et éprouvés ; pagination infinie du feed native dans TanStack Query. |
| `react-native-maps` | Carte interactive « Mamans autour de moi » (Apple Maps / Google Maps natifs). |

*Alternative écartée : Flutter — excellent, mais casse le partage de types avec un backend Node et le vivier de développeurs React est plus large en France.*

### 2.2 Backend — **Node.js + NestJS (TypeScript)**

| Choix | Justification |
|---|---|
| NestJS | Architecture modulaire imposée (modules/providers/guards) → sécurité **structurée** : guards d'auth, interceptors de rate limiting, pipes de validation (`class-validator`) sur chaque endpoint. |
| Node.js | I/O non bloquant : idéal pour un réseau social (beaucoup de connexions concurrentes, WebSockets, peu de calcul CPU). |
| REST (OpenAPI) + WebSocket | REST versionné `/v1` pour tout le CRUD (cacheable, simple à sécuriser endpoint par endpoint) ; WebSocket (Socket.IO + adapter Redis) pour le chat temps réel et la présence. GraphQL écarté en v1 : surface d'attaque plus large (requêtes profondes), caching plus complexe. |
| BullMQ (sur Redis) | Files de jobs : modération IA asynchrone, envoi push, purge RGPD, fan-out du feed. Le fil de requête reste rapide. |

*Alternative écartée : Django/Python — très bon pour du CRUD, mais le temps réel (chat, présence) y est moins naturel (channels) et on perdrait le TypeScript partagé.*

### 2.3 Données

| Brique | Rôle | Pourquoi |
|---|---|---|
| **PostgreSQL 16 + PostGIS** | Source de vérité : users, posts, messages, géo | ACID, `citext`, `pgcrypto`, RLS. **PostGIS remplace MongoDB pour la géoloc** : index GiST sur `geography`, requêtes « autour de moi » en ms. Une seule base = moins de surface d'attaque et de synchronisation. |
| **Redis 7** | Cache, sessions refresh, rate limiting (sliding window), pub/sub WebSocket, compteurs likes | Latence sub-ms ; l'adapter Redis de Socket.IO permet de scaler la gateway WS sur N instances. |
| **S3 compatible, région UE** + CDN | Photos (posts, avatars) | Upload direct mobile → S3 via URL présignée (l'API ne voit jamais les octets) ; chiffrement au repos SSE ; CDN pour la lecture. |
| **OpenSearch** *(phase 2)* | Recherche plein-texte posts/groupes | Pas nécessaire au lancement : `tsvector` Postgres suffit au début. |

*MongoDB écarté : aucune donnée réellement non-relationnelle ici, et un réseau social est fondamentalement relationnel (users ↔ posts ↔ commentaires ↔ groupes).*

### 2.4 Sécurité & conformité (résumé — détaillé à l'Étape 4)

- **Transit** : TLS 1.3 partout, HSTS, certificate pinning dans l'app mobile.
- **Repos** : disques chiffrés (AES-256) **+ chiffrement applicatif en enveloppe (AES-256-GCM via KMS)** pour les données sensibles : messages privés, prénoms/dates de naissance des enfants, position.
- **Auth** : Argon2id, JWT d'accès courts (15 min) + refresh tokens **rotatifs et révocables** (stockés hachés), OAuth Google/Apple (Sign in with Apple obligatoire sur iOS), 2FA TOTP optionnel.
- **Rate limiting** : global (gateway) + par endpoint (`@nestjs/throttler` sur Redis) + verrouillage progressif anti-brute-force.
- **RGPD** : hébergement 100 % UE (Scaleway/OVHcloud ou AWS `eu-west-3` Paris), registre des consentements en base, suppression de compte en un clic (soft delete immédiat + purge définitive J+30 par job), export des données (portabilité), analytique **auto-hébergée et anonymisée** (Matomo ou PostHog EU).
- **Modération** : blocklist de mots + classification IA asynchrone de chaque post/commentaire/photo avant amplification (Claude API), file de revue humaine.

### 2.5 Infra & exploitation

- **Docker + Docker Compose** en dev ; **Kubernetes managé UE** (ou ECS) en prod — l'API étant stateless, le scaling horizontal est trivial.
- CI/CD GitHub Actions : lint, tests, scan de dépendances (`npm audit`, Trivy), déploiement bleu/vert.
- Observabilité : Sentry (erreurs, sans PII), Prometheus + Grafana (métriques), logs structurés **sans données personnelles**.
- Sauvegardes Postgres chiffrées, PITR, restauration testée.

---

## 3. Scalabilité — trajectoire

| Palier | Utilisateurs | Évolution |
|---|---|---|
| V1 | 0 → 100 k | Monolithe NestJS ×2-3 instances, 1 Postgres (+ réplica lecture), 1 Redis. Feed calculé à la lecture (voir Étape 2). |
| V2 | 100 k → 1 M | Réplicas lecture Postgres, partitionnement de `messages` (par mois), fan-out du feed vers Redis pour les comptes actifs, OpenSearch, CDN agressif. |
| V3 | > 1 M | Extraction des modules chat et feed en services dédiés (déjà isolés), sharding éventuel par région. |

Le principe directeur : **rien dans l'architecture V1 ne devra être jeté** pour atteindre V3.
