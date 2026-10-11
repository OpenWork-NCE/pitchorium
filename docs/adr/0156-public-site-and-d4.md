# 0156. Site public éditorial et dialecte D4

Statut : acceptée (2026-10-11).

## Contexte

Le site public est la première impression de Pitchorium pour un investisseur, une fondation ou un entrepreneur (§1, §6.1). Le contenu ne vient que du cahier des charges et de l'api : aucune statistique ni témoignage inventé.

## Décision

- Groupe `(marketing)` en vue visiteur, sans fournisseur de l'espace membre : accueil (`/{locale}`, promesse du §3, trois usages, deux publics et leurs parcours du §5, principes du §4, projets mis en avant lus dans l'api puis les plus récents, appel à l'inscription), fonctionnement (`/how-it-works`), transparence et frais (`/transparency`), pages juridiques (`/legal/{document}`, ADR 0157).
- Transparence : la commission (taux et version) et la couverture des paiements viennent de `GET /v1/public/payments/coverage`, qui publie désormais la commission en vigueur ; frais des prestataires, non-détention des fonds (ADR 0043), impact auto-déclaré (lien vers la méthodologie), contribution qui n'est pas un titre, pas de reçu fiscal (ADR 0137). Les prestataires ne sont jamais nommés (ADR 0136).
- Composants serveur seulement ; le seul code client ajouté est celui des cartes de projet (montants, impact) et de `SplitHeading`.
- Pied de page des pages publiques (`SiteFooter`, composant serveur) : pages éditoriales et juridiques, accueil dans chaque langue active, adresse de contact de la configuration (`CONTACT_EMAIL`), aucun réseau social. Le 404 garde son pied de page minimal (aucun code client).
- SEO : sitemap avec les alternatives de chaque langue active, JSON-LD `Organization` et `WebSite` (avec `SearchAction` vers `/search`) sur l'accueil, image de partage générée pour chaque page éditoriale, adresse canonique et alternatives par page, `robots.ts` inchangé (espaces membre et administration exclus).
- Mouvement D4 : titre `h1` révélé mot à mot en CSS (H13, peint dès le rendu serveur), titres de section révélés en lignes par `SplitHeading` (GSAP et SplitText chargés à l'approche, vue visiteur seulement), cartes de projet révélées par `clip-path` (classe `clip-reveal`), motif de la marque entré par un zoom (H24, `hero-scale-crop`) et déplacé de 8 % au plus (`parallax-soft`), pied de page découvert (H29, `footer-uncover`, à partir de 768 x 640 px). Animations liées au défilement (`animation-timeline: view()`), sans repli : sans elles, l'état final. Le lavage de couleur (H22) n'est pas retenu : une seule couleur d'accent et aucun décor gratuit (`direction.md`). Ni WebGL, ni curseur, ni préchargeur, ni détournement de la molette ; aucun nom de transition de vue ajouté.

## Conséquences

- Budget du groupe `(marketing)` : 151 à 160 kB pour 190 kB.
- L'accueil provisoire et ses « fondations » sont retirés ; les parcours qui les utilisaient visent l'accueil éditorial.
