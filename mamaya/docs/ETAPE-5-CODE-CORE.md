# Mamaya — Étape 5 : Code core

> Les éléments fondateurs, implémentés en TypeScript. Chaque fichier applique
> concrètement les protocoles de l'Étape 4 — les commentaires dans le code
> pointent la règle de sécurité qu'ils mettent en œuvre.

## Arborescence livrée

```
mamaya/
├── backend/src/
│   ├── crypto/
│   │   └── envelope-crypto.service.ts   # AES-256-GCM en enveloppe (KMS), AAD, crypto-shredding
│   ├── users/
│   │   ├── user.entity.ts               # modèle Utilisateur (TypeORM) + trimestre calculé
│   │   ├── user-profile.entity.ts       # profil public (pseudo, jamais le nom légal)
│   │   ├── child.entity.ts              # enfants : prénom/date chiffrés, mois en clair
│   │   ├── users.service.ts             # inscription Argon2id, anti-énumération, suppression RGPD
│   │   └── dto/register.dto.ts          # validation stricte + consentements versionnés
│   └── geo/
│       └── geo.service.ts               # floutage ~1 km + jitter HMAC, k-anonymat, Mode Fantôme
└── mobile/src/features/nearby/
    ├── api.ts                           # client API du module nearby
    └── NearbyMapScreen.tsx              # carte react-native-maps + Mode Fantôme 👻
```

## Ce que chaque pièce garantit

### `envelope-crypto.service.ts`
- Une **DEK par utilisatrice**, générée et déchiffrée par le KMS ; seule la version chiffrée (EDK) est persistée.
- Ciphertext auto-porté `nonce ‖ tag ‖ data`, **AAD** liant chaque blob à `user_id + champ` (un blob copié ailleurs ne se déchiffre pas).
- `evictUser()` + destruction de l'EDK = **crypto-shredding** à la purge RGPD.

### `user.entity.ts` / `users.service.ts`
- `passwordHash`, `totpSecretEnc`, `providerSub` en `select: false` : impossibles à exposer par accident.
- **Argon2id** (64 Mio / 3 / 4) ; vérification en **temps constant** avec hachage factice si le compte n'existe pas (anti-énumération).
- Inscription transactionnelle : compte + profil + **consentements versionnés** (preuve RGPD) dans la même transaction.
- `requestDeletion()` : soft delete immédiat, **position et refresh tokens détruits tout de suite**, purge planifiée J+30.
- `pregnancyTrimester` : la seule granularité de la grossesse jamais exposée aux autres.

### `geo.service.ts`
- `fuzzPosition()` : snap sur grille **~1,1 km** + jitter **déterministe** HMAC(user_id) — la position exacte n'atteint jamais la base.
- Upsert **1 ligne/utilisatrice** : pas d'historique de déplacement, par conception.
- `findNearby()` : consentement requis, blocages bilatéraux, **k-anonymat (< 5 → vide)**, distances arrondies, filtres âge des enfants (sur `birth_month`) et affinités — et **aucune coordonnée en sortie**.
- Mode Fantôme = `UPDATE` qui sort la ligne de l'index partiel : exclusion structurelle, pas un filtre applicatif.

### `NearbyMapScreen.tsx`
- **Écran de consentement d'abord**, permission OS ensuite ; refus géré avec bienveillance.
- La carte n'affiche que des **cercles de zone (~1 km)** placés d'après la distance arrondie — jamais de pin précis, car le client ne connaît tout simplement pas les positions des autres.
- **Mode Fantôme** : bascule optimiste avec rollback, masquage immédiat de ma position et de la liste (symétrie : invisible = je ne vois plus non plus).
- Filtres de rayon (2/5/10/25 km), rafraîchissement périodique, précision GPS `Balanced` (inutile de demander plus précis que le floutage serveur).

## Prochaines briques (dans l'ordre conseillé)
1. Module `auth` complet (JWT EdDSA + refresh rotatifs + OAuth Google/Apple + TOTP).
2. Migrations SQL (le DDL de l'Étape 2 est prêt à convertir en migrations TypeORM).
3. Module `feed` (posts + pipeline de modération BullMQ → blocklist puis IA).
4. Gateway WebSocket chat (Socket.IO + adapter Redis) avec chiffrement des messages via `EnvelopeCryptoService`.
5. CI GitHub Actions : lint, tests, scan dépendances, puis déploiement conteneurisé UE.
