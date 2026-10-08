# 0065. Projection de recherche par événements

Statut : acceptée (2026-10-08). Précise l'ADR 0005.

## Contexte

La recherche (§10.6) et le matching (§11.4) portent sur cinq types d'entités possédées par cinq modules. Les frontières interdisent de lire leurs tables (ADR 0002), et la recherche doit respecter la visibilité de chaque donnée (profils privés par défaut, volets aux détails privés, événements et missions réservés aux membres, blocages, modération).

## Décision

- discovery construit sa propre projection dans son schéma : un document par entité et par audience (`members`, `public`), calculé par le domaine à partir des sources lues par les façades des modules propriétaires. Une audience qui ne doit rien voir n'a pas de document ; le texte n'est jamais plus large que la page correspondante.
- Mise à jour par les événements outbox de profiles, organizations, projects, events et missions : le handler relit l'entité par la façade et réécrit ses documents dans la transaction de l'inbox (idempotent). Une entité devenue non indexable (brouillon, supprimée, modérée) est retirée de l'index et des suggestions.
- Reconstruction complète (`pnpm discovery:reindex`) depuis les façades, et contrôle de dérive (`--check`, tâche quotidienne) par empreinte de chaque document : un écart est réparé et publié (`discovery.index.drift-detected.v1`).
- Les images ne sont pas indexées : les cartes les demandent aux façades à la lecture (URL présignées courtes pour un fichier privé).

## Conséquences

- La recherche a un léger retard (relais de l'outbox) sur les écritures ; le contrôle de dérive rattrape un événement manqué en un jour au plus.
- Un module qui ajoute un champ indexé ajoute sa source à la façade et, s'il le faut, un événement que discovery consomme.
