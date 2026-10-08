# 0092. Chemins d'URL non traduits

Statut : acceptée (2026-10-08). Tranche la question ouverte 98.

## Contexte

L'ADR 0084 écrivait les chemins en anglais pour toutes les langues (`/fr/sign-in`) et laissait ouverte leur traduction (`/fr/connexion`). Traduire les segments multiplie les chemins par langue, les redirections à maintenir quand un libellé change, les liens partagés qui cassent d'une langue à l'autre, et oblige à traduire avant d'activer une langue (wolof, lingala) des segments qu'un humain doit relire.

## Décision

- Les segments d'URL ne sont jamais traduits : le chemin d'une page est le même dans toutes les langues, seul le préfixe de langue change (`/fr/projects/...`, `/en/projects/...`).
- Les chemins sont en anglais, en minuscules, avec des tirets, et vivent dans `apps/web/src/config/routes.ts`.
- Le référencement passe par les alternates hreflang (langues actives seulement) et par le contenu localisé de la page, pas par le chemin.

## Conséquences

- Changer de langue ne change que le préfixe : un lien partagé reste valable dans toutes les langues actives.
- Activer une langue n'exige aucune traduction de chemin ni redirection nouvelle.
- La question ouverte 98 est fermée.
