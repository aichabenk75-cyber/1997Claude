# Mamaya — Module Auth (brique V1 n°1)

> Implémentation complète de l'authentification spécifiée aux Étapes 3-4.
> Code : `backend/src/auth/` · Tables : `backend/migrations/0001_init.sql` (§2).

## Fichiers

| Fichier | Rôle |
|---|---|
| `token.service.ts` | JWT d'accès **EdDSA** (15 min, `kid` pour rotation des clés) + génération/hachage des refresh tokens opaques (256 bits, SHA-256 en base). |
| `refresh-token.entity.ts` | Tokens stockés **hachés**, avec `familyId` (chaîne de rotations par appareil). |
| `auth.service.ts` | Orchestration : login (+ 2FA), OAuth, **rotation avec détection de rejeu**, logout. |
| `brute-force.service.ts` | Compteurs Redis : 10 essais/15 min/IP + verrouillage progressif par compte (1 min → 15 min → 1 h). Clés Redis **hachées** (pas de PII). |
| `totp.service.ts` | 2FA TOTP : secret chiffré en enveloppe (P0), 10 codes de secours à usage unique hachés, fenêtre ±30 s. |
| `oauth.service.ts` | Vérification **côté serveur** des tokens Google / Apple contre leurs JWKS (signature, émetteur, audience). |
| `guards/jwt-auth.guard.ts` | Guard NestJS + décorateur `@CurrentUser()` — vérification sans requête base. |
| `auth.controller.ts` | Routes `/v1/auth/*` avec les limites de débit de l'Étape 3. |
| `dto/auth.dto.ts` | Validation stricte de chaque body. |

## Flux clés

### Connexion avec 2FA
```
POST /v1/auth/login {email, password}
  → anti-brute-force (IP + compte) → Argon2id (temps constant)
  → totp_enabled ?
      non → { accessToken, refreshToken }
      oui → { twoFactorRequired: true, ticket }     (aucun token émis)
POST /v1/auth/2fa/verify {ticket, code}
  → ticket consommé (GETDEL, usage unique même si le code est faux)
  → code TOTP ±30 s OU code de secours (consommé atomiquement)
  → { accessToken, refreshToken }
```

### Rotation des refresh tokens et détection de vol
```
POST /v1/auth/refresh {refreshToken}
  → token inconnu            → 401
  → token déjà utilisé/révoqué → REJEU : toute la famille est révoquée → 401
    (l'appareil légitime devra se reconnecter ; l'attaquant perd tout)
  → token valide             → marqué usedAt, nouveau token de la MÊME famille,
                               nouveau JWT d'accès
```

### Première connexion OAuth
```
POST /v1/auth/oauth/google {idToken}
  → vérif JWKS serveur → compte inconnu → 409 auth/onboarding_required
POST /v1/auth/oauth/google {idToken, displayName, status, cguVersion, dueDate?}
  → création transactionnelle (compte + profil + consentements) → tokens
```

## Décisions de sécurité notables

- **Aucune réponse ne révèle l'existence d'un compte** : hachage factice si l'email est inconnu (temps constant), erreurs génériques, verrouillage identique compte existant ou non.
- **JWT asymétriques (EdDSA)** : les futurs services (chat, feed) vérifieront avec la seule clé publique — la clé privée ne vit que dans le service d'auth.
- Le guard **ne touche pas la base** : la paire « JWT 15 min + refresh révocable » borne la fenêtre d'exposition d'un compte banni/supprimé à 15 minutes maximum.
- Le ticket 2FA est **à usage unique même en cas d'échec** : impossible de brute-forcer le code TOTP sur un même ticket.
- `deviceLabel` est le seul métadonnée de session (choisie par l'utilisatrice) : **pas d'IP ni d'empreinte** stockée — minimisation.

## Reste à brancher (configuration, pas du code métier)

1. Factories du module : clés EdDSA (env/KMS) → `TokenService.init()`, client IDs OAuth, connexion Redis partagée.
2. Jobs BullMQ : email de vérification (`one_time_tokens`), purge des refresh tokens expirés.
3. Tests : unitaires (rotation/rejeu, verrouillage progressif, TOTP) + e2e sur les flux ci-dessus.
