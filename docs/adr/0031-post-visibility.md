# 0031. Visibilité des publications

Statut : acceptée (2026-10-07)

## Contexte

Une publication professionnelle n'a pas toujours vocation à être publique : la confidentialité par défaut (ADR 0017) et les pages publiques paramétrables (§13) imposent des niveaux d'audience, cohérents avec la page publique de l'auteur, avec les repartages et avec les fichiers (ADR 0026).

## Décision

- Trois niveaux : `public` (aussi sans compte, par `GET /v1/public/posts/{id}`), `members` (défaut), `connections` (l'auteur et ses connexions). Une publication d'organisation est `public` ou `members` (une organisation n'a pas de connexions).
- `public` exige la page publique de l'auteur à l'écriture. Désactiver la page : lecture immédiate en `members` (visibilité effective calculée à chaque lecture), puis réécriture en `members` par le worker sur `profiles.profile.visibility-changed.v1`, avec déplacement des images vers le bucket privé. La réactivation ne rétablit pas `public` : l'auteur choisit de nouveau.
- Règle de lecture unique (`canView`, domaine) appliquée au fil, aux pages, aux repartages, aux commentaires, aux réactions et à la lecture des fichiers : supprimée ou `removed` invisible ; `hidden` visible de l'auteur seul ; blocage de part et d'autre invisible ; puis le niveau d'audience.
- Un repartage n'élargit jamais l'audience de l'original : `public` se repartage avec toute visibilité, `members` en `members` ou `connections`, `connections` seulement par son auteur. Le repartage d'un repartage vise l'original. L'original reste soumis à sa propre visibilité : un lecteur qui ne peut pas le voir reçoit `repostOf: null`.

## Conséquences

- Une publication publique d'un auteur sans page publique n'est jamais servie sans compte, même entre la désactivation et le passage du worker.
- Les images d'une publication suivent sa visibilité (bucket public seulement pour `public`) ; le document reste privé.
