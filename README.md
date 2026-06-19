# 🎉 ML Academy — Page de Félicitations (post-paiement)

Page de confirmation moderne pour produit digital à délivrance immédiate, affichée
après la validation du paiement. Design repris **à l'identique de l'esprit du site**
(fond `#0A0A0A`, accent orange `#F97316`, police **Inter**, halo + confettis, coche
animée) avec un **gros bouton Télécharger**.

## Fichiers

| Fichier | Rôle |
|---|---|
| [`test-felicitation.html`](./test-felicitation.html) | 🆕 **Page v2 (3 accès : Discord · Fournisseurs · Vinted)** — aperçu autonome + source. |
| [`felicitations-page-content.html`](./felicitations-page-content.html) | 🆕 Contenu v2 **poussé dans la page Shopify** « Félicitation » (sans `<html>/<head>/<body>`). |
| [`felicitations.html`](./felicitations.html) | Page v1 autonome — **aperçu** (à ouvrir dans un navigateur) + source. |
| [`page.felicitations.liquid`](./page.felicitations.liquid) | Template Shopify v1 (page autonome `{% layout none %}`). |
| [`order-status-additional-scripts.html`](./order-status-additional-scripts.html) | Bannière + bouton pour la page de statut de commande (juste après paiement). |
| [`INTEGRATION.md`](./INTEGRATION.md) | **Guide d'intégration Shopify pas à pas** (FR). |

## Démarrage rapide

1. Ouvre `felicitations.html` dans ton navigateur pour voir le rendu.
2. Remplace le `href="#"` du bouton `id="downloadBtn"` par ton lien de téléchargement.
3. Suis [`INTEGRATION.md`](./INTEGRATION.md) pour la mise en ligne sur Shopify.

> Aperçus, navigateur headless et captures sont générés dans `.preview/` (ignoré par git).
