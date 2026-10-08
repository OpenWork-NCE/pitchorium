# 0078. Administration

Statut : acceptée (2026-10-08).

## Contexte

Les routes de back-office étaient nées avec chaque module, sous des préfixes différents (`/v1/access/users/...`, `/v1/organization-verification-requests`, `/v1/posts/{id}/feature`...). Le cahier des charges demande une modération, des rôles et des réglages (§13, §14) ; les feature flags se modifiaient en base sans contrôle ni trace.

## Décision

- Convention : toute route de back-office est sous `/v1/admin/<domaine>`, protégée par une action réservée à `admin` (ou `moderator`) avec double authentification ; les actions sensibles (rôles, flags, remboursements, suppression de compte) exigent une session récente.
- Chaque route reste dans le module propriétaire de son domaine ; le module admin ne porte que ce qui est transverse (membres, flags, mises en avant, tâches en échec, statistiques, audit) et passe par les façades : aucun module ne dépend de lui.
- Lire des données personnelles depuis le back-office est audité.
- Les flags passent par des garde-fous : locales par le module localization (ADR 0077), financement en titres et prêts avec une référence juridique enregistrée, le paiement en ligne restant refusé sans adaptateur habilité.
- Les mises en avant éditoriales des publications, des projets et des profils passent par une seule interface.
- Les tâches BullMQ en échec définitif sont consultables et relançables, de manière auditée et idempotente.

## Conséquences

- Le client d'administration appelle un seul préfixe ; les anciennes routes de mise en avant et de rôles sont retirées (frontend non encore livré).
- Une file ajoutée par un module apparaît d'elle-même dans les tâches en échec (découverte par Redis).
