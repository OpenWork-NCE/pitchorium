# Captures de revue

Captures des compositions de référence de Storybook (`apps/web/src/stories/compositions`) et des pages des projets et de l'impact, pour la revue de design. Chaque composition assemble le système (`docs/design/components.md`) sur des données typées par `@pitchorium/contracts` ; les textes sont des maquettes, pas des données métier. Les pages, composants serveur hors de portée de Storybook, sont prises sur le build des tests de bout en bout (`.next-e2e`) servi avec l'api simulée (`e2e/support/serve.mjs`, contenus de `stub-projects.mjs`), par `e2e/review/pages.review.ts`.

## Contenu

Fichiers `<composition>-<format>-<thème>.png` : format `desktop` (1280x800) ou `mobile` (390x844), thème `light` ou `dark`, page entière, mouvement réduit, langue française, polices de la marque, anticrénelage en niveaux de gris (`--disable-lcd-text` : l'anticrénelage sous-pixel de l'image dessinait des liserés colorés sur les grands textes gras, un artefact de la capture, pas un effet de la page).

- `member-shell-loading` : cadre membre (bandeau, compteurs ; sur téléphone, Messages et Notifications au bandeau), composeur, fil en squelettes.
- `member-shell-loaded` : le même cadre, fil chargé sans titre visible ; sur ordinateur, profil à gauche, projet compact et suggestions à droite ; sur téléphone, complétion du profil en tête du fil et suggestions après le troisième élément.
- `profile-card-story` : `ProfileCompletion` en carte (colonne gauche) et en module (tête du fil sur téléphone).
- `project-card-story` : `ProjectCard` en variantes `full` (paliers et leur état) et `compact`, montants sans décimales, impact teinté.
- `notifications-list` : `NotificationItem`, lues et non lues : colonne média fixe, pastille du type, extrait de la publication, demande de connexion à accepter ou ignorer sur place.
- `conversation` : `ConversationThread` sur deux jours (séparateurs, groupes, heure courte, « Lu ») et `MessageComposer` (hauteur automatique, pièce jointe).
- `form-with-server-errors` : formulaire complet (dates en segments, fuseau dit une fois) après une règle vérifiée dans le navigateur puis une réponse RFC 9457 de l'api : résumé focalisé avec un lien par erreur, messages précis sous les champs, actions empilées sur téléphone.
- `admin-table` : cadre d'administration, fil d'Ariane, tableau triable : première colonne collante, libellés uniques (« Email », « Email vérifié »), infobulle d'une action en icône seule ; sur téléphone, une carte par ligne.
- `auth-sign-in` : écran partagé de l'authentification (ADR 0104) : panneau de marque violet au motif d'élévation et promesse du §3 à gauche, boutons Google, LinkedIn et Microsoft puis l'email en chemin secondaire à droite ; sur téléphone, le formulaire d'abord, le panneau ensuite.
- `auth-two-factor` : défi de la double authentification, code à six chiffres en cases, bascule vers un code de secours.
- `onboarding-profile` : dernière étape de l'onboarding, étapes en tête, barre de force du profil, photo par dépôt de fichier, nom, titre, pays, « Entrer dans Pitchorium » et « Passer ».
- `showcase` : vitrine des projets, filtres (pays, secteur, statut, impact minimum), tri, grille de `ProjectCard`.
- `project-visitor` et `project-member` : page projet en vue visiteur (indexable, mouvement D4) et en vue membre (suivre, manifester un intérêt, équivalent indicatif en FCFA) ; sur ordinateur, contenu éditorial à gauche et financement collant à droite ; sur téléphone, financement en tête et barre d'action en bas.
- `project-funded` et `project-closed` : états finaux du bloc financement.
- `wizard-<étape>` : les dix étapes de l'assistant de création sur un brouillon (`essentials`, `story`, `media`, `funding`, `rewards`, `instruments`, `impact`, `team`, `preview`, `publish`).
- `manage-overview` et `manage-interests` : espace de gestion du projet, vue d'ensemble et manifestations d'intérêt.
- `methodology` : méthodologie d'impact en vigueur.
- `settings-security` : paramètres de sécurité, mot de passe (fermeture des autres sessions annoncée), double authentification, sessions actives avec cet appareil marqué et révocation.

## Régénérer et vérifier

```sh
pnpm --filter @pitchorium/web review:captures   # réécrit les captures
pnpm --filter @pitchorium/web review:check      # les compare aux captures commitées
```

`review:check` échoue sur un écart de plus de 1 % des pixels (tolérance des captures de bout en bout), après deux captures consécutives identiques (le fil virtualisé mesure ses entrées) ; il tourne au niveau 3 et à chaque push qui touche les composants, les stories, les styles ou les tokens (`docs/architecture/testing.md`). `REVIEW_SKIP_BUILD=1` réutilise `storybook-static` et `.next-e2e`. Après un changement visuel voulu, régénérer et commiter les captures.

Le script construit Storybook et le build des tests de bout en bout, sert le premier sur le port 6106 et le second sur les ports 3201 et 3299 (refus si un port est pris), puis prend les captures dans l'image Playwright officielle (Docker requis), comme les captures de référence des tests de bout en bout. Chaque capture attend la fin des chargements différés (réseau au repos, plus aucun `aria-busy` ni `data-loading`, sauf la composition de l'état de chargement) et, pour les compositions, vérifie : qu'aucun élément ne dépasse l'un des quatre bords de la composition, sauf dans un conteneur qui défile ; que rien n'est coupé par un conteneur qui masque son débordement sans défiler (images recadrées, textes tronqués exprès et éléments déplacés par une transformation exceptés) ; qu'il n'y a qu'un logo par écran (les marques `data-brand-mark` et les fonds du kit qui portent un logotype) ; que rien ne touche le bord d'une carte (`data-card` : 8 px de sa marge intérieure au moins restent libres).
