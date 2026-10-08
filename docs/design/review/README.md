# Captures de revue

Captures des compositions de référence de Storybook (`apps/web/src/stories/compositions`), pour la revue de design. Chaque composition assemble le système (`docs/design/components.md`) sur des données typées par `@pitchorium/contracts` ; les textes sont des maquettes, pas des données métier.

## Contenu

Fichiers `<composition>-<format>-<thème>.png` : format `desktop` (1280x800) ou `mobile` (390x844), thème `light` ou `dark`, page entière, mouvement réduit, langue française.

- `member-shell-loading` : cadre membre (bandeau, compteurs, trois colonnes), fil en squelettes.
- `member-shell-loaded` : le même cadre, fil chargé, carte de profil, carte de projet, suggestions.
- `profile-card-story` : carte de profil avec force du profil.
- `project-card-story` : carte de projet avec `FundingProgress` (paliers) et `ImpactBadge`.
- `notifications-list` : liste de notifications, lues et non lues.
- `conversation` : fil de messages et zone de saisie.
- `form-with-server-errors` : formulaire complet après une réponse RFC 9457 de l'api (résumé, erreurs placées sous leurs champs).
- `admin-table` : cadre d'administration, fil d'Ariane, tableau triable.

## Régénérer

```sh
pnpm --filter @pitchorium/web review:captures
```

Le script construit Storybook, le sert sur le port 6106 (refus si le port est pris), puis prend les captures dans l'image Playwright officielle (Docker requis), comme les captures de référence des tests de bout en bout. Chaque capture vérifie aussi qu'aucun élément ne dépasse le bord de la composition, sauf dans un conteneur qui défile.
