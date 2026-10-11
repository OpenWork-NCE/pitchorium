# 0160. Visuels de démonstration générés

Statut : acceptée (2026-10-11).

## Contexte

Les images de l'api simulée (galeries et couvertures des projets, actualités, publications, couverture d'organisation) étaient des aplats de couleur unie : les captures de revue, les captures de référence et les aperçus du produit montraient des rectangles sans forme. Les projets de Kaolack et de Mbour reprenaient l'histoire de Thiès. La direction artistique interdit les banques d'images, les photos ou illustrations produites par une IA et les personnes inventées (`direction.md`).

## Décision

- `pnpm --filter @pitchorium/web demo:visuals` (`scripts/demo-visuals.mjs`, sharp) dessine chaque image à partir des formes de la marque (les têtes et les épaules de ses trois figures : cercles et croissants) dans sa palette (violet, cuivre, lavande, blanc et noir de marque), sans texte, et varie la composition selon le secteur : énergie (soleil cuivré sur des champs), agriculture (sillons et récoltes), pêche (vagues sous un soleil bas), éducation (trois figures qui s'élèvent), artisanat (cercles entrelacés), document (blocs d'une page).
- Les fichiers PNG sont versionnés comme ressources de démonstration dans `apps/web/e2e/support/demo-visuals/` : servis par l'api simulée seulement (`/files/<nom>`), jamais par le build de production, comme le reste des données de démonstration (le seed de développement est refusé en production).
- Textes alternatifs justes : ils décrivent le visuel (« Visuel de démonstration : un soleil cuivré au-dessus de champs violets »), jamais une scène qu'il ne montre pas.
- Chaque projet de démonstration a son histoire, cohérente avec son titre, son lieu et son secteur (Thiès, Kaolack, Mbour, Podor).

## Conséquences

- Les captures de revue, de référence et les aperçus du produit (ADR 0161) montrent des projets illustrés ; une nouvelle image de l'api simulée s'ajoute à `VISUALS` puis le script se relance.
- Le seed de développement de l'api (`apps/server/scripts/dev-seed/images.ts`) garde ses dégradés à formes abstraites, qui ne sont pas des aplats.
