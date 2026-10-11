# 0159. Voix éditoriale

Statut : acceptée (2026-10-11).

## Contexte

Le site public de l'ADR 0156 était exact mais se lisait comme une documentation : titre d'accueil long, comparaisons avec d'autres services (« ni un Instagram africain, ni un Kickstarter générique »), vocabulaire interne (« deux couches », « case à cocher manuelle », « s'indexent »), principes écrits comme des maximes plutôt que comme des engagements. Un investisseur, une fondation ou un entrepreneur doit comprendre en quelques secondes ce qu'est Pitchorium et ce qu'il y gagne.

## Décision

- `docs/design/voice.md` fixe la voix : professionnelle, chaleureuse et concrète ; vouvoiement ; phrases courtes ; le bénéfice avant le fonctionnement ; aucun jargon technique ou interne ; aucune comparaison dénigrante ; exemples à faire et à éviter, et une grille de relecture.
- Le français est la source, l'anglais s'aligne sur lui avec la même retenue.
- Titre de l'accueil : la promesse de la marque, « Le lieu d'affaires de la synergie Afrique–Diaspora. » ; la phrase de positionnement du §3 passe en sous-titre.
- Principes de confiance écrits comme des engagements envers la personne (« Les montants affichés sont de vrais paiements confirmés », « Les langues proposées sont relues par des personnes »), sans perdre leur exactitude.
- La page Transparence garde toute sa précision factuelle (commission lue dans l'api, non-détention des fonds, impact auto-déclaré, contribution qui n'est pas un placement, pas de reçu fiscal).

## Conséquences

- Tout nouveau texte du site public et de l'interface se relit avec la grille de `voice.md`.
- Aucune statistique, aucun témoignage, aucun partenaire tant que l'api ne les donne pas : la règle de l'ADR 0156 est inchangée.
