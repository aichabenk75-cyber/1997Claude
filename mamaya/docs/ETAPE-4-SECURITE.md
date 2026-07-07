# Mamaya — Étape 4 : Protocoles de sécurité

> Mini-guide technique : comment le backend protège **la géolocalisation** et
> **les données de santé et des enfants**. Complète les Étapes 1-2 (le schéma
> et la stack ont été conçus autour de ces protocoles, pas l'inverse).

---

## 1. Classification des données

| Niveau | Données | Traitement |
|---|---|---|
| **P0 — critiques** | Messages privés, prénom + date de naissance exacte des enfants, position, secret TOTP | Chiffrement applicatif AES-256-GCM (enveloppe), accès journalisé, jamais dans les logs/analytics |
| **P1 — sensibles (art. 9 RGPD)** | Statut (enceinte/maman), date de terme, centres d'intérêt santé (allaitement…) | Consentement explicite, minimisation en sortie d'API, exclues de l'analytique |
| **P2 — personnelles** | Email, pseudo, ville (libellé), photos | TLS + chiffrement disque, droits d'accès stricts |
| **P3 — publiques** | Posts publics, catégories, badges | Protégées en intégrité (modération, anti-usurpation) |

Principe directeur : **minimisation**. La meilleure protection d'une donnée est de ne pas la collecter (pas de nom légal, pas d'historique de déplacement, pas de date de naissance exacte en clair).

---

## 2. Chiffrement en enveloppe (données P0)

```
   KMS (HSM, région UE)                    PostgreSQL
   ┌──────────────────┐                    ┌─────────────────────────────┐
   │ Clé maîtresse    │                    │ user_keys                   │
   │ (jamais exportée)│──déchiffre──┐      │  user_id | edk (DEK chiffrée)│
   └──────────────────┘             │      └─────────────────────────────┘
                                    ▼
                          DEK par utilisatrice (en mémoire seulement, cache TTL court)
                                    │
                    AES-256-GCM : nonce ‖ ciphertext ‖ tag
                                    ▼
                     colonnes bytea : body_enc, first_name_enc, birthdate_enc…
```

Règles d'implémentation (voir `backend/src/crypto/envelope-crypto.service.ts`) :

1. **Une DEK (Data Encryption Key) par utilisatrice**, générée par le KMS, stockée **uniquement chiffrée** (EDK) en base. La clé maîtresse ne quitte jamais le KMS.
2. **AES-256-GCM** avec nonce aléatoire de 12 octets **unique par chiffrement** ; l'`AAD` (donnée authentifiée additionnelle) contient `user_id` + nom de colonne → un ciphertext déplacé vers une autre ligne/colonne ne se déchiffre pas.
3. **Crypto-shredding** : à la purge RGPD (J+30), on détruit l'EDK → toutes les données P0 de l'utilisatrice deviennent définitivement illisibles, **y compris dans les sauvegardes** (les backups contiennent les ciphertexts mais plus aucune clé).
4. **Rotation** : la clé maîtresse KMS tourne annuellement (re-chiffrement des EDK seulement — pas des données) ; une DEK compromise se re-chiffre par utilisatrice.
5. Les DEK déchiffrées vivent dans un cache mémoire court (TTL 5 min, jamais Redis, jamais de swap), invalidé au logout/suppression.

Pourquoi pas du chiffrement de bout en bout (E2EE) pour le chat ? Décision assumée en V1 : l'E2EE empêcherait la **modération des messages signalés** (harcèlement en DM — risque majeur pour ce public) ; le compromis retenu est le chiffrement au repos côté serveur + accès au déchiffrement uniquement via le flux de signalement, journalisé. À réévaluer en V2 (E2EE opt-in pour les DM).

---

## 3. Géolocalisation : « précis pour le produit, flou pour la base »

### 3.1 Pipeline d'écriture

```
Mobile (GPS exact) ──TLS 1.3──▶ API PUT /v1/me/location
   1. Consentement 'geoloc' actif ?  sinon → refus
   2. FLOUTAGE serveur (jamais stocké exact) :
        snap sur grille ~1,1 km  (troncature à 0,01°)
      + jitter DÉTERMINISTE par utilisatrice :
        HMAC-SHA256(secret_serveur, user_id) → décalage stable ∈ [-400 m, +400 m]
   3. UPSERT user_locations (1 ligne/utilisatrice, PAS d'historique)
```

- Le **jitter déterministe** est essentiel : un bruit aléatoire à chaque mise à jour se moyennerait par observations répétées ; un décalage fixe par utilisatrice ne révèle rien de plus à la 1000ᵉ requête qu'à la 1ʳᵉ.
- La position exacte n'existe **nulle part** côté serveur : ni en base, ni dans les logs (middleware de scrubbing : `lat`/`lng` masqués), ni dans les traces APM.

### 3.2 Règles de lecture (`GET /v1/nearby`)

1. **Jamais de coordonnées en sortie** — uniquement `distance_km` arrondie au km et un libellé de zone (`geohash5`, ~5 km).
2. **k-anonymat** : si moins de **5 profils** dans le rayon demandé, réponse vide (« Pas encore assez de mamans par ici 💛 ») — empêche d'isoler une personne en zone rurale.
3. **Anti-trilatération** : rate limit 20 req/h, rayon minimal 2 km, distances arrondies + jitter fixe → recouper plusieurs requêtes ne converge pas vers un point.
4. **Mode Fantôme** : `ghost_mode = true` sort de l'index partiel PostGIS → exclusion **immédiate et structurelle** (ce n'est pas un filtre applicatif qu'un bug pourrait oublier).
5. Blocages appliqués **dans les deux sens** dans la requête SQL (une personne bloquée ne me voit plus et je ne la vois plus).
6. `DELETE /v1/me/location` supprime la ligne — la révocation du consentement `geoloc` déclenche la même suppression automatiquement.

---

## 4. Données de santé et des enfants

- **Enfants** : `first_name_enc` et `birthdate_enc` chiffrés (P0). Le produit fonctionne sur `birth_month` (mois tronqué, en clair) : matching « Bébés de mai 2026 », feed par tranche d'âge. Le prénom déchiffré n'apparaît que pour **la mère elle-même** (`GET /v1/me/children`) — jamais dans un profil public, une API de matching ou un log.
- **Grossesse** (`status`, `due_date`) : donnée de santé (art. 9 RGPD) → collecte sous **consentement explicite** à l'inscription, finalité affichée (personnalisation du feed). Exposée aux autres uniquement en **granularité grossière** (« enceinte — 2ᵉ trimestre »), jamais la date de terme exacte.
- **Sortie d'API systématiquement minimisée** : DTO de sérialisation explicites (liste blanche de champs) — on n'expose jamais une entité brute ; toute nouvelle donnée est **privée par défaut**.
- **Accès interne** : aucune lecture directe de la prod ; le back-office modération n'affiche les contenus P0 déchiffrés que dans le contexte d'un signalement, chaque lecture étant tracée dans `audit_logs` (qui, quoi, quand, pourquoi).
- **Analytique** : auto-hébergée (UE), événements **sans identifiant direct** (pseudonymisation par hachage salé rotatif), jamais de P0/P1 dans les événements.

---

## 5. Authentification & anti-abus (rappel opérationnel)

| Mesure | Paramètres |
|---|---|
| Hachage mots de passe | **Argon2id** — mémoire 64 Mio, itérations 3, parallélisme 4 (recalibré annuellement) |
| JWT accès | 15 min, signé asymétrique (EdDSA), `kid` pour rotation des clés de signature |
| Refresh tokens | Opaques, stockés **hachés**, rotation à chaque usage, détection de réutilisation → révocation de toute la famille |
| Brute force | Redis : 10 essais/15 min/IP **et** verrouillage progressif par compte (1 min → 15 min → 1 h) ; réponses en temps constant, sans révéler si l'email existe |
| 2FA | TOTP (RFC 6238), secret chiffré (P0), 10 codes de secours à usage unique hachés |
| Mobile | Tokens dans `expo-secure-store` (Keychain/Keystore), **certificate pinning**, biométrie locale optionnelle |
| Transport | TLS 1.3 uniquement, HSTS preload, en-têtes durcis (CSP, `X-Content-Type-Options`…) |
| Uploads | URLs S3 présignées à durée courte, validation type/poids, ré-encodage systématique des images (supprime EXIF **dont le GPS** 📍 — indispensable ici) et neutralise les payloads |

**Défense en profondeur** : chaque couche suppose que la précédente peut échouer — WAF → rate limiting → validation DTO → autorisations par ressource (guards NestJS : « suis-je membre de cette conversation ? ») → index partiels/contraintes SQL → chiffrement → audit.
