# 🎉 Page de Félicitations ML Academy — Guide d'intégration Shopify

Page de confirmation moderne affichée après la validation du paiement, dans l'esprit
exact du site (fond sombre `#0A0A0A`, accent orange `#F97316`, police Inter, halo + confettis,
coche animée et **gros bouton Télécharger**).

---

## 🆕 MISE À JOUR — Page « Félicitation » v2 (3 accès)

La page **Félicitation** de la boutique (`/pages/felicitation`) a été refondue avec **3 sections
d'accès distinctes** correspondant aux 3 promesses du Pack : **Discord VIP**, **Pack 1000
Fournisseurs (PDF)** et **Bonus Vinted (PDF)**. Logos Discord & Vinted en **SVG inline** (officiels,
aucune dépendance CDN).

| Fichier | À quoi ça sert |
|---|---|
| **`test-felicitation.html`** | Page v2 complète, autonome → **aperçu** (ouvre dans un navigateur) + source de référence. |
| **`felicitations-page-content.html`** | **Contenu exact** poussé dans Shopify (sans `<!DOCTYPE>/<html>/<head>/<body>`). |

**Méthode d'intégration utilisée : « contenu de page » (sans toucher au thème).**
1. Le **contenu** de la page existante **Félicitation** (rubrique *Boutique en ligne → Pages*) a été
   remplacé par `felicitations-page-content.html` (via l'API Admin). Le thème **MoneyLab** n'est pas modifié :
   l'en-tête / le pied du thème restent autour de la page, qui s'affiche en pleine largeur (full‑bleed `.mla`).
2. **Liens footer mappés aux vrais handles** de la boutique :
   `/pages/contact` · `/pages/mentions-legales` · `/pages/conditions-generales-de-vente` · `/pages/politique-de-confidentialite`.
3. **Lien Discord** configuré : `https://discord.gg/aUXVt2kesJ`.

### ⏳ Reste à faire : brancher les 2 PDF
Dans la page (éditeur `< >`), remplace les placeholders :
- `[LIEN_PDF_FOURNISSEURS]` → URL du PDF « 1000 Fournisseurs »
- `[LIEN_PDF_VINTED]` → URL du PDF « TOP 10 Vinted »

> 💡 Pour que l'attribut `download` **force** réellement le téléchargement, héberge les PDF sur le
> **même domaine** (*Contenus → Fichiers* Shopify → URL `cdn.shopify.com/...`). Sur un lien externe
> (Google Drive…), le navigateur ouvre le fichier au lieu de le télécharger. Tant qu'un placeholder
> n'est pas remplacé, un garde-fou JS prévient au clic.

---

## 📁 Fichiers fournis

| Fichier | À quoi ça sert |
|---|---|
| **`felicitations.html`** | La page complète, autonome. Sert d'**aperçu** (ouvre-la dans un navigateur) et de source. |
| **`page.felicitations.liquid`** | **Version Shopify (recommandée)** : template de page autonome (`{% layout none %}`). |
| **`order-status-additional-scripts.html`** | Bannière + bouton à coller sur la page de **statut de commande** (juste après paiement). |

---

## ✅ Étape 1 — Mettre ton lien de téléchargement (le plus important)

Ouvre `felicitations.html` **ou** `page.felicitations.liquid` et cherche `id="downloadBtn"` :

```html
<a id="downloadBtn" data-download href="#" download class="btn dl r d2">
```

➡️ Remplace `href="#"` par le lien de ton produit digital :
- un fichier hébergé sur Shopify (**Contenus → Fichiers**, puis copie l'URL),
- ou Google Drive / Dropbox / Notion / WeTransfer, etc.

Exemple : `href="https://cdn.shopify.com/.../mon-pack.pdf"`

Pense aussi à remplacer le `href="#"` du bouton **Discord** (`id="discordBtn"`).

> Tant que le lien n'est pas configuré, un message d'alerte prévient au clic (garde-fou).

---

## 🚀 Étape 2 — Méthode recommandée : page personnalisée Shopify

Cette méthode crée une vraie page autonome `https://ta-boutique.com/pages/felicitations`,
sans en-tête ni pied de page du thème (rendu plein écran, comme l'aperçu).

1. **Admin Shopify → Boutique en ligne → Thèmes → ⋯ → Modifier le code.**
2. Dans **Templates**, clique **Ajouter un template** → type **`page`** → nom **`felicitations`**.
   Shopify crée `templates/page.felicitations.liquid`.
3. **Supprime tout** le contenu généré et **colle l'intégralité de `page.felicitations.liquid`** fourni. Sauvegarde.
4. **Boutique en ligne → Pages → Ajouter une page.**
   - Titre : `Félicitations`
   - À droite, dans **Modèle de thème**, choisis **`page.felicitations`**.
   - Enregistre.
5. Ta page est en ligne : **`/pages/felicitations`** 🎉

---

## 💳 Étape 3 — Y envoyer le client après le paiement

Après le paiement, Shopify affiche la **page de statut de commande**. On y ajoute un bouton
vers ta page de félicitations :

1. **Admin Shopify → Réglages → Paiement** (Checkout).
2. Section **« Page de statut de la commande » → Scripts supplémentaires.**
3. Colle le contenu de **`order-status-additional-scripts.html`**. Enregistre.

Le client voit alors « 🎉 Bienvenue dans le Lab ! » avec un bouton
**« Accéder à mon espace & télécharger »** qui ouvre `/pages/felicitations`.

> Option : pour rediriger automatiquement, tu peux ajouter dans les scripts supplémentaires
> `<script>setTimeout(function(){location.href='/pages/felicitations';},1200);</script>`
> (déconseillé : le client perd le récapitulatif de commande — un bouton est plus propre).

> ⚠️ Le champ « Scripts supplémentaires » existe sur tous les plans, mais le **Checkout Shopify**
> récent (Checkout Extensibility) peut le limiter aux plans supérieurs. Si tu ne le vois pas,
> mets simplement le lien `/pages/felicitations` dans l'email de confirmation de commande
> (**Réglages → Notifications → Confirmation de commande**) et dans la page produit.

---

## 🎨 Alternative simple (sans toucher au code du thème)

Si tu préfères ne pas créer de template :
1. **Boutique en ligne → Pages → Ajouter une page**, titre `Félicitations`.
2. Dans l'éditeur de contenu, clique sur **`< >` (Afficher le code HTML)**.
3. Colle le contenu **du `<body>`** de `felicitations.html` (sans `<html>`/`<head>`).

> Cette méthode garde l'en-tête/pied de page du thème autour de la page. La méthode
> « template Liquid » (Étape 2) donne un rendu plein écran identique à l'aperçu — recommandée.

---

## 🔧 Personnalisation rapide

| Élément | Où le changer |
|---|---|
| Lien de téléchargement | `id="downloadBtn"` → `href` |
| Lien Discord | `id="discordBtn"` → `href` |
| Email de support | `mailto:contact@mlacademy.fr` |
| Textes / titres | directement dans le HTML |
| Couleur d'accent | variable `--or` dans le `<style>` (actuellement `#F97316`) |
| Liste « accès débloqué » | bloc `<ul class="ulist">` |

Tout est responsive (mobile/desktop) et respecte `prefers-reduced-motion`.
