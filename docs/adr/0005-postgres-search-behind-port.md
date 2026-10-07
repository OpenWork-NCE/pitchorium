# 0005. Recherche PostgreSQL derrière un port

Statut : acceptée (2026-10-07)

## Contexte

La recherche porte sur des personnes, organisations et projets, en plusieurs langues et avec des noms accentués. Le volume initial ne justifie pas un moteur dédié.

## Décision

Recherche implémentée en PostgreSQL (full-text, `pg_trgm` pour la tolérance aux fautes, `unaccent` pour les accents), extensions créées par la migration initiale. Le module `discovery` y accède par un port, de sorte qu'un adaptateur Meilisearch puisse le remplacer sans toucher aux use cases.

## Conséquences

- Aucune infrastructure supplémentaire au lancement ; l'index est cohérent avec les données transactionnelles.
- L'indexation inter-modules se fera à partir des événements de domaine, pas par lecture directe des tables d'autres modules.
