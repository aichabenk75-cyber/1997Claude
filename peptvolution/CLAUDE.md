# PEPT'VOLUTION — Instructions projet (source de vérité)

> ⚠️ **Ce fichier fait autorité pour tout le travail dans `peptvolution/`.**
> Il **remplace** toute instruction d'un `CLAUDE.md` parent — notamment l'ancien
> projet **« ML Academy »** à la racine du repo (import Chine, accent orange,
> « Rejoindre le Lab »…), qui **ne s'applique PAS** ici.
> Projet **indépendant** : aucune couleur, marque, convention ou contenu d'un
> ancien projet ne doit interférer. En cas de doute, **ce dossier prime**.

---

## 1. Marque & positionnement
- **Marque : PEPT'VOLUTION** (peptide × évolution). Wordmark `PEPT'VOLUTION`,
  l'apostrophe sert d'accent coloré.
- **Produit** : cure peptide pour la **perte de poids**. Unité = **kit 10 mg**
  qui dure **≈ 1 mois** à raison d'**1 prise / semaine**. Sans privation, sans yo-yo.
- Le **nom du peptide n'est PAS affiché** — on parle toujours de « kit 10 mg ».
- **Promesse** : perte de poids durable, simple, soutenue par la science, vérifiable.
- **Signature** : « Ton corps, allégé par la science. »
- **Public** : large, santé / bien-être. **Ton : tutoiement**, premium mais
  accessible, **emojis avec parcimonie** (jamais d'excès).
- **Langue : français.**

## 2. Offres (prix RÉELS — architecture neuromarketing)
| Offre | Prix | Plein barré | Économie | / kit | / semaine |
|---|---|---|---|---|---|
| 1 kit (≈1 mois) | **149 €** | — | — | 149 € | ≈ 37 € |
| 3 kits (≈3 mois) | **349 €** | ~~447 €~~ | **−98 € (−22 %)** | 116 € | ≈ 29 € |
| 5 kits (≈5 mois) | **499 €** | ~~745 €~~ | **−246 € (−33 %)** | 99,80 € | < 25 € |

- Leviers : **ancrage** (prix barrés), **décomposition** (prix au kit + coût/sem),
  **effet de compromis** (pack 3 mis en avant), **meilleure valeur** (pack 5),
  charm pricing (9), **aversion à la perte** (garantie 60 j), réduction de friction
  (« paiement unique · sans abonnement »), urgence honnête (« tarifs de lancement »).

## 3. Design (résumé — détail complet dans `DESIGN.md`)
- **Esthétique** : clinique **premium lumineux**, niveau « Terminal Industries »
  côté soin / motion / 3D. Fond clair = confiance médicale ; accents teal/menthe =
  vitalité ; **une section « labo » sombre** pour le contraste cinématographique.
- **Règle CTA absolue** : le **bouton d'achat est TOUJOURS VERT** (`.btn-buy`,
  `--go #15C25A`) → code « go » + santé. Le **corail ne sert JAMAIS au geste
  d'achat** : uniquement aux économies/badges (accent secondaire).
- **Typo** : **Fraunces** (titres), **Plus Jakarta Sans** (UI/texte),
  **JetBrains Mono** (données techniques).
- **CSS entièrement scopé sous `.pv`** ; pleine largeur full-bleed ; responsive ;
  `prefers-reduced-motion` respecté ; contrastes AA.

## 4. Éthique / conformité — IMPORTANT (sujet réglementé)
- **Aucune allégation thérapeutique**, **aucun résultat garanti**.
- **Pas de fausses preuves** : témoignages, statistiques, % de pureté, termes de
  garantie = **PLACEHOLDERS** tant que non confirmés (toujours les marquer).
  Les **prix** sont réels (fournis par le client).
- **Disclaimer médical** en pied de page, à faire valider par un juriste.

## 5. Conventions de code
- Page **autonome** ; **tout le CSS scopé sous `.pv`** (zéro conflit avec le thème).
- Full-bleed Shopify : `left:50%;margin-left:-50vw;width:100vw` + conteneurs centrés.
- **Robustesse** : contenu visible par défaut ; on ne le masque pour l'animer que si
  JS actif ; **filet de sécurité** révélant tout après ~2,6 s ; **Three.js avec
  fallback** (bokeh canvas) + pause hors-écran + cap DPR.
- **Aucune séquence Liquid (`{{`, `{%`) dans le CSS/JS** — à vérifier avant livraison.

## 6. Intégration Shopify
- Voir `INTEGRATION.md`. Home statique → template `page.<nom>.liquid` débutant par
  `{% layout none %}` puis tout le document enveloppé dans `{% raw %}…{% endraw %}`.

## 7. Workflow
- Brancher sur la branche de dev de la session (`claude/friendly-heisenberg-05z00n`).
- Commits **en français**, clairs. Push avec retry/backoff.
- **Après chaque modif** : livrer le `.html` dans le chat + proposer un aperçu.
- ⚠️ **Ne jamais modifier/supprimer les fichiers des anciens projets** (racine du
  repo) sans demande explicite.

## 8. Fichiers du dossier
- `index.html` — home PEPT'VOLUTION (aperçu + source).
- `CLAUDE.md` — ce fichier (instructions projet).
- `DESIGN.md` — système de design détaillé (tokens, typo, composants, motion).
- `INTEGRATION.md` — guide d'intégration Shopify.
- `README.md` — vue d'ensemble.
