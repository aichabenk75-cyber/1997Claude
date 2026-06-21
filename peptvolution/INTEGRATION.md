# PEPT'VOLUTION — Intégration Shopify

La home `index.html` est **autonome** (CSS scopé `.pv`, JS en fin de page, aucune
séquence Liquid). Deux méthodes pour la mettre en ligne.

---

## Méthode 1 — Template Liquid (recommandé, plein écran)

Rend la page **sans en-tête/pied du thème** (vraie landing).

1. Dans le thème (Édition du code), créer `templates/page.accueil.liquid`
   (ou un autre nom : l'URL sera `/pages/<nom>`).
2. Première ligne : `{% layout none %}`.
3. La page est **statique** → envelopper **tout le document** dans
   `{% raw %} … {% endraw %}` juste après `{% layout none %}`, afin que Liquid
   n'interprète pas les `{` / `}` du CSS/JS.

```liquid
{% layout none %}
{% raw %}
<!DOCTYPE html>
<html lang="fr">
  … (coller ici l'intégralité de index.html) …
</html>
{% endraw %}
```

4. Dans l'admin Shopify : **Pages → Ajouter une page**, puis dans
   « Modèle de page » choisir `page.accueil`. Publier.
5. (Option) Pour en faire la page d'accueil : **Boutique en ligne → Préférences**,
   ou rediriger `/` vers `/pages/accueil`.

> ✅ Vérifié : `index.html` ne contient **aucun** `{{` ni `{%` → le `{% raw %}`
> protège l'ensemble sans risque.

## Méthode 2 — Coller dans une page (secours)

Éditeur de page → bouton `< >` (afficher le HTML) → coller le contenu de
`index.html`. ⚠️ L'en-tête et le pied du **thème** restent affichés autour.

---

## Dépendances externes (CDN)
La page charge en ligne :
- **Google Fonts** : Fraunces, Plus Jakarta Sans, JetBrains Mono.
- **Three.js r128** (hero 3D) + **GSAP / ScrollTrigger** (parallaxe).

Tout est en **progressive enhancement** : sans réseau/WebGL, la page reste
lisible (polices système + fallback 2D). Pour de la perf/robustesse, on pourra
plus tard héberger ces librairies en `assets/` du thème.

## Avant publication — checklist
- [ ] Remplacer les **placeholders** : pureté réelle (COA), témoignages vérifiés,
      statistiques, termes exacts de la garantie 60 j.
- [ ] Brancher les **boutons d'achat** sur les vrais liens produit / checkout.
- [ ] Faire **valider le disclaimer médical** par un juriste.
- [ ] Vérifier les liens du footer (`/pages/contact`, `/pages/mentions-legales`,
      `/pages/cgv`, `/pages/confidentialite`).
