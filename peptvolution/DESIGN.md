# PEPT'VOLUTION — Système de design

Référence visuelle du projet. **Tout le CSS est scopé sous `.pv`.**
Esthétique : **clinique premium lumineux**, soin du détail et du mouvement de
niveau « Terminal Industries », adapté à un produit **santé / minceur**.

---

## 1. Couleurs (tokens CSS)

```css
/* Surfaces claires */
--bone:#F6F7F4;   --white:#FFFFFF;   --soft:#EEF1EC;
/* Encre / texte */
--ink:#0C1513;    --ink-2:#3B4642;   --muted:#6B7873;  --faint:#9AA6A0;
/* Teal — accent principal (vitalité, clinique) */
--teal:#0FB5A6;   --teal-2:#34D8C0;  --teal-deep:#0B7C72;  --teal-bg:#E6F7F3;
/* Vert "GO" — bouton d'ACHAT uniquement */
--go:#15C25A;     --go-2:#22D169;    --go-deep:#0E9E45;    --go-bg:#E4F8EC;
/* Corail — accent SECONDAIRE (économies, badges) — jamais l'achat */
--coral:#FF6A52;  --coral-2:#FF8769; --coral-deep:#E64B33; --coral-bg:#FFEDE7;
/* Divers */
--amber:#F5A623;                       /* étoiles d'avis */
--line:#E4E8E3;   --line-2:#EDF0EC;    --ink-line:rgba(255,255,255,.12);
--dark:#06201D;   --dark-2:#0A2A26;    /* section "labo" + footer */
```

### Règle d'or du CTA
- **Achat / passer à l'action → VERT (`--go`)** via la classe `.btn-buy`.
- **Corail = accent secondaire** : badges d'économie (`−98 €`, `−33 %`), badge
  « Le plus populaire », aurores, dégradés décoratifs. **Jamais sur un bouton d'achat.**
- Le vert est volontairement **plus jaune que le teal** pour rester saillant sur fond teal.

## 2. Typographie
- **Display — `Fraunces`** (serif éditorial, `--fd`) : H1/H2, mots-clés en `italic`
  (`.serif-i`). Poids 500–600.
- **UI / texte — `Plus Jakarta Sans`** (`--fb`) : paragraphes, boutons, nav, listes.
- **Technique — `JetBrains Mono`** (`--fm`) : eyebrows, prix au kit, labels labo,
  données, mentions « paiement unique ».
- Échelle : `h1` clamp(44→82px), `h2` clamp(32→56px), `.lead` clamp(16→19px).
- Letter-spacing serré sur les titres (`-.015em` à `-.03em`).

## 3. Formes & profondeur
- Rayons : `--r:16px` · `--r-lg:22px` · `--r-xl:30px` · `--r-full:100px`.
- Ombres douces : `--shadow` (cartes), `--shadow-lg` (éléments mis en avant).
- Transition standard : `--t:.4s cubic-bezier(.2,.7,.2,1)`.

## 4. Composants
- **Boutons** : `.btn` + variante.
  - `.btn-buy` (vert, ACHAT) · `.btn-ghost` (bordure) · `.btn-dark` (encre) ·
    `.btn-white` (sur fond sombre). Hover = `translateY(-2/3px)` + halo.
- **Cartes** : fond blanc, `--line`, rayon `--r-lg`, ombre douce, hover `translateY(-6px)`.
- **Badges/pills** : `.pop` (corail, « Le plus populaire ») · `.pop.val` (teal,
  « Meilleure valeur ») · `.save` (pill corail d'économie) · `.launch-pill`.
- **Grille de prix** `.price-grid` : 3 plans, le médian `.best` (agrandi, CTA vert).
- **FAQ** `.acc` : accordéon, un seul ouvert à la fois.
- **Barre CTA collante** `.scta` : apparaît après le hero, ancre prix + bouton vert.
- **Marquee** `.marquee` : bandeau de confiance défilant (dupliqué en JS).
- **Compteurs** `.stat .v[data-count]` : animation au scroll, format FR.
- **Section sombre** `.proof` : contraste cinématographique (labo / COA terminal).

## 5. Mouvement & 3D
- **Révélation** : classes `.r` → `.in` (IntersectionObserver), délais `.d1`→`.d5`.
  Contenu **visible par défaut** ; masqué seulement si `.pv.anim` ; **filet de
  sécurité** révèle tout après ~2,6 s.
- **Aurores** : 3 halos flous animés derrière le hero (teal/corail), pausés en
  `reduced-motion`.
- **Hero 3D (Three.js r128)** : grappe de sphères glossy (`MeshPhysicalMaterial` +
  clearcoat + **environment map** procédurale), particules ascendantes (« léger »),
  ombre douce au sol, parallaxe souris + réaction au scroll (GSAP ScrollTrigger).
  **Fallback** : bokeh `<canvas>` 2D si pas de WebGL. Pause hors-écran / onglet caché.
- **Toujours** respecter `prefers-reduced-motion` (anime off, contenu visible).

## 6. Layout & responsive
- Wrapper full-bleed (`.pv`), conteneurs `.wrap` (max 1240px, centrés).
- Breakpoints : **1024px** (nav → burger, grilles en colonne) · **600px** (mobile).
- Rythme de sections clair/sombre : majorité claire, **une** section `.proof`
  sombre + CTA final en dégradé teal→dark + footer sombre.

## 7. À faire / À éviter
- ✅ CTA d'achat **vert** ; corail réservé aux économies/accents.
- ✅ Hiérarchie typo Fraunces (titres) / Jakarta (texte) / Mono (données).
- ✅ Beaucoup d'air, ombres douces, contrastes AA, animations sobres et robustes.
- ❌ Pas de bouton d'achat orange/corail.
- ❌ Pas d'allégation santé, pas de fausses preuves (cf. `CLAUDE.md` §4).
- ❌ Pas de `{{` / `{%` dans le CSS/JS (compat Shopify Liquid).
- ❌ Ne pas réintroduire l'ancien design « ML Academy » (orange/import Chine).
