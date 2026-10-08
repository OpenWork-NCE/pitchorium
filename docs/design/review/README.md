# Captures de revue

Captures des compositions de référence de Storybook (`apps/web/src/stories/compositions`), pour la revue de design. Chaque composition assemble le système (`docs/design/components.md`) sur des données typées par `@pitchorium/contracts` ; les textes sont des maquettes, pas des données métier.

## Contenu

Fichiers `<composition>-<format>-<thème>.png` : format `desktop` (1280x800) ou `mobile` (390x844), thème `light` ou `dark`, page entière, mouvement réduit, langue française, polices de la marque, anticrénelage en niveaux de gris (`--disable-lcd-text` : l'anticrénelage sous-pixel de l'image dessinait des liserés colorés sur les grands textes gras, un artefact de la capture, pas un effet de la page).

- `member-shell-loading` : cadre membre (bandeau, compteurs ; sur téléphone, Messages et Notifications au bandeau), composeur, fil en squelettes.
- `member-shell-loaded` : le même cadre, fil chargé sans titre visible ; sur ordinateur, profil à gauche, projet compact et suggestions à droite ; sur téléphone, complétion du profil en tête du fil et suggestions après le troisième élément.
- `profile-card-story` : `ProfileCompletion` en carte (colonne gauche) et en module (tête du fil sur téléphone).
- `project-card-story` : `ProjectCard` en variantes `full` (paliers et leur état) et `compact`, montants sans décimales, impact teinté.
- `notifications-list` : `NotificationItem`, lues et non lues : colonne média fixe, pastille du type, extrait de la publication, demande de connexion à accepter ou ignorer sur place.
- `conversation` : `ConversationThread` sur deux jours (séparateurs, groupes, heure courte, « Lu ») et `MessageComposer` (hauteur automatique, pièce jointe).
- `form-with-server-errors` : formulaire complet (dates en segments, fuseau dit une fois) après une règle vérifiée dans le navigateur puis une réponse RFC 9457 de l'api : résumé focalisé avec un lien par erreur, messages précis sous les champs, actions empilées sur téléphone.
- `admin-table` : cadre d'administration, fil d'Ariane, tableau triable.

## Régénérer

```sh
pnpm --filter @pitchorium/web review:captures
```

Le script construit Storybook, le sert sur le port 6106 (refus si le port est pris), puis prend les captures dans l'image Playwright officielle (Docker requis), comme les captures de référence des tests de bout en bout. Chaque capture vérifie aussi qu'aucun élément ne dépasse le bord de la composition, sauf dans un conteneur qui défile.
