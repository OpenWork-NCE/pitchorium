# 0035. Données de développement par les services

Statut : acceptée (2026-10-08)

## Contexte

`pnpm db:seed:dev` écrit ses données directement dans les tables de chaque module (membres, organisations, fichiers, réseau, publications), hors des frontières des modules. Les invariants métier, l'outbox et le journal d'audit n'y sont pas exercés : une donnée de démonstration peut être dans un état que l'application ne produirait jamais.

## Décision

- À partir du PROMPT 4, toute nouvelle donnée de développement passe par les services d'application ou les façades des modules, dans le graphe d'application de l'api (`createSeedContext`, `scripts/dev-seed/seed-dev-projects.ts`). Une horloge contrôlée par le script remplace `Clock` (outil de développement, par `@nestjs/testing`) : les services datent eux-mêmes publications, contributions et échéances dans le passé, et la clôture des campagnes passe par le service de la tâche planifiée.
- Concerné aujourd'hui : la méthodologie DEMO (`ensureDemo`), les évaluations des volets entrepreneur, les projets dans tous les statuts (paliers, contreparties et réservations, équipe, publication avec consentement, contributions par `applyFunding`, actualités, manifestations d'intérêt), les suivis de projets et les publications rattachées.
- Idempotence par clé naturelle : un projet dont le slug existe est ignoré ; chaque projet est écrit dans une seule transaction, à laquelle les services se joignent.
- Les données existantes (membres, comptes, acceptations, profils et volets, organisations et membres, fichiers, connexions, suivis de membres, publications, commentaires, réactions) restent écrites directement : écart documenté ci-dessous.

## Évaluation de la migration des données existantes

- Comptes : la création passe par Better Auth (hachage, vérification d'email par lien, envoi d'emails), et le profil de base est créé par un handler du worker sur `identity.user.registered.v1` ; le script devrait piloter l'API d'authentification et attendre le worker.
- Identifiants : le script actuel dérive des UUIDv7 déterministes des clés du jeu de données, ce qui rend l'insertion idempotente et lie publications, commentaires et réactions entre eux. Les services génèrent leurs identifiants : publications, commentaires et réactions n'ont pas de clé naturelle, l'idempotence d'une seconde exécution deviendrait impossible sans marqueur ajouté au modèle pour le seul besoin du script.
- Bases de développement déjà remplies : changer d'identifiants dupliquerait ou désynchroniserait les données des développeurs.

Le coût dépasse le bénéfice pour un outil de développement dont ces données ne changent plus : la migration n'est pas faite.

## Conséquences

- Les nouvelles données de démonstration produisent les mêmes événements que l'usage réel (outbox) ; le worker les traite à son prochain passage.
- Les données existantes restent hors des invariants : toute évolution de leur modèle doit mettre à jour le script et son test (`dev-seed.spec.ts`).
- Les montants collectés des projets de démonstration passent par `applyFunding`, seule voie légitime, avant le module payments.
