# 0077. Garde-fous de l'activation des langues

Statut : acceptée (2026-10-08).

## Contexte

« Une langue mal traduite vaut mieux absente » (§4) : le swahili, le wolof et le lingala ne doivent apparaître qu'avec des traducteurs natifs et une relecture (§8.2, §8.3). Les flags `locale.sw`, `locale.wo`, `locale.ln` existaient, modifiables en base sans contrôle.

## Décision

- L'activation d'une locale passe par le module localization, appelé par l'administration des flags : refusée (`LOCALIZATION_LOCALE_NOT_READY`) si le catalogue n'est pas complet à 100 % par rapport au français (aucune clé absente ni vide, `catalogCompleteness` de `@pitchorium/i18n`) ou si le manifeste ne porte pas le statut `reviewed` avec un relecteur et une date.
- La désactivation est toujours possible. Chaque changement est audité et annoncé (`localization.locale.enabled.v1`, `localization.locale.disabled.v1`).
- Le manifeste est modifié par une pull request, avec les traductions approuvées dans l'outil de traduction (`docs/architecture/i18n-workflow.md`).

## Conséquences

- Une langue ne peut pas être activée « pour voir » : il faut d'abord ses traductions relues dans le dépôt, puis un déploiement.
