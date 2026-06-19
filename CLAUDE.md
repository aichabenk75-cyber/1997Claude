# ML Academy — Pages personnalisées Shopify

Contexte projet pour toute session travaillant sur ce repo. **À lire en premier.**

## Activité / marque
- Boutique Shopify : `moneylabvip.myshopify.com` — marque affichée : **ML Academy** (MoneyLab, **créée en 2026**).
- Activité : accompagnement digital « **import Chine → revente France** ». Produit : **Pack Premium 29,99 €** (au lieu de 59,99 €), **produit digital à délivrance immédiate**, Discord VIP, bonus niches.
- CTA récurrent : « **Rejoindre le Lab** ». Ton : **tutoiement**, public jeune (14–25 ans), motivant, **emojis**.
- Langue : **français**.

## Système de design (à respecter pour toute nouvelle page)
- **Police** : Inter (Google Fonts, poids 400→900).
- **Couleurs** :
  - Fond sombre / noir : `#0A0A0A`
  - Accent orange (« or ») : `#F97316` · hover `#EA580C` · clair `#FED7AA` · bg clair `#FFF7ED` · bordure `#FDBA74`
  - Vert succès : `#16A34A` / `#22C55E` · bg `#DCFCE7`
  - Rouge : `#EF4444` · bg `#FEF2F2` · Ambre (étoiles) : `#F59E0B`
  - Gris : 50 `#F9FAFB` · 100 `#F3F4F6` · 200 `#E5E7EB` · 400 `#9CA3AF` · 500 `#6B7280` · 700 `#374151` · 900 `#111827`
- **Rayons** : 8 / 12 / 16 / 100px. **Transition** : `.2s ease`. Ombres douces.
- **Ambiance** : hero sombre `#0A0A0A` avec **halo orange radial** + **motif de points** (`radial-gradient(rgba(249,115,22,.05) 1px,transparent 1px); background-size:30px`). Sections claires sur blanc. Cartes arrondies bordées. Boutons `.btn-or` (orange, hover `translateY(-2px)` + glow). Pills à point clignotant. **Animations de révélation** (`.r` → `.in` via IntersectionObserver). Badges de confiance (🔒 ⚡ 📞).
- **Logo** : `ML <em>ACADEMY</em>` (le mot « ACADEMY » en orange `#F97316`).
- **Footer pleine largeur** : logo + description à gauche, liens à droite (**Contact, Mentions légales, CGV, Confidentialité** → `/pages/contact`, `/pages/mentions-legales`, `/pages/cgv`, `/pages/confidentialite`), ligne basse « **© 2026 ML Academy. Tous droits réservés.** » + « Fait pour les revendeurs ambitieux 🔥 ».

## Conventions de code (établies sur la page Félicitations)
- Page **autonome** ; **tout le CSS scopé sous un wrapper** (ex. `.mla`) pour éviter les conflits avec le thème Shopify.
- **Pleine largeur dans une page Shopify** : wrapper full-bleed `left:50%;margin-left:-50vw;width:100vw`. Conteneurs internes centrés (`max-width` + `margin:0 auto`).
- **Responsive** (breakpoints ~1024 / 768 / 680 / 480). Respecter `prefers-reduced-motion`.
- **Révélation robuste** : contenu **visible par défaut** ; on ne le cache pour l'animer que si JS actif (classe `anim` sur le wrapper) + **filet de sécurité** qui révèle tout après ~2,6 s (rien ne doit rester invisible).

## Intégration Shopify (2 méthodes)
1. **Template Liquid (recommandé)** : créer `templates/page.<nom>.liquid`, **commencer par `{% layout none %}`** → rendu plein écran sans en-tête/pied du thème. Créer une Page dans l'admin et lui assigner ce template. URL finale : `/pages/<nom>`.
   - Page **statique** (ex. Félicitations) : envelopper tout le document dans **`{% raw %}…{% endraw %}`** (après `{% layout none %}`) pour que Liquid n'interprète pas les `{`/`}` du CSS/JS.
   - Page **avec Liquid actif** (ex. formulaire de contact) : **NE PAS** utiliser `{% raw %}`. Veiller alors à ce que le CSS/JS **ne contiennent aucune séquence `{{` ni `{%`**.
2. **Coller dans une page** via l'éditeur HTML `< >` (garde l'en-tête/pied du thème autour — méthode de secours).

## Tâche en cours : page Contact
- **Objectif** : page Contact **dans le même esprit**, **responsive**, **intégrable Shopify**, avec **uniquement un formulaire de contact**.
- **Utiliser le formulaire natif Shopify** : `{% form 'contact' %} … {% endform %}` (envoie un email au compte de la boutique).
  - Champs : `contact[name]`, `contact[email]` (requis), `contact[phone]` (optionnel), `contact[body]` (message).
  - Succès : `{% if form.posted_successfully %}` → afficher un message de confirmation (Shopify ajoute `?contact_posted=true`).
  - Erreurs : `{% if form.errors %}` → afficher les messages (`form.errors.translated_fields`).
- **Style** : fond sombre + halo orange ; carte de formulaire `rgba(255,255,255,.03)` bordée ; champs fond sombre + bordure `rgba(255,255,255,.1)` + **focus orange** ; bouton `.btn-or` « Envoyer le message » ; logo en haut ; **footer pleine largeur** (mêmes liens). Tutoiement + 1–2 emojis.
- **Livrables** : `contact.html` (aperçu/source) + `page.contact.liquid` (template). Mettre à jour `INTEGRATION.md` / `README.md` si utile.

## Fichiers du repo
- `felicitations.html` — page de félicitations post-paiement (aperçu + source)
- `page.felicitations.liquid` — template Shopify (`{% layout none %}{% raw %}…{% endraw %}`)
- `order-status-additional-scripts.html` — bannière post-paiement (Réglages → Paiement → « Scripts page de statut »)
- `INTEGRATION.md` — guide d'intégration Shopify (FR) · `README.md` — vue d'ensemble
- `.preview/` (ignoré par git) — puppeteer + `shot.js` pour générer des captures (`preview-*.png`)

## Workflow
- Brancher sur la branche de dev de la session (actuellement `claude/determined-hamilton-etfhtz`). ⚠️ **Pas encore de branche `main`** dans le repo.
- Commits clairs **en français**. Pousser avec retry/backoff.
- **Après chaque modif** : livrer le fichier `.html` dans le chat (outil d'envoi de fichier) **et montrer un aperçu** (capture via `.preview/shot.js`, ou ouvrir le fichier).
