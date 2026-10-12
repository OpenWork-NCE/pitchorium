# 0166. Expérience d'un compte suspendu

Statut : acceptée (2026-10-12).

## Contexte

Une suspension (ADR 0073) refuse au membre toute action de l'api (`ACCESS_ACCOUNT_SUSPENDED`), sauf celles marquées `allowWhenSuspended` : compte, préférences, conditions, notifications, situation de modération, appel, export et suppression des données. Le fil, le réseau, les projets et la messagerie lui sont donc fermés, en lecture comme en écriture, et ses sessions sont révoquées au début de la suspension. Le membre doit le comprendre sans rencontrer d'erreur, et savoir où lire la décision.

## Décision

- Un bandeau de la coquille membre (`banners.suspended`) dit que le compte est suspendu et mène à `/settings/moderation`, qui ouvre sur la suspension, sa date de fin et ce qui reste ouvert (la page, les notifications, les paramètres, les données personnelles).
- Le fil, page d'arrivée après la connexion, montre à sa place `SuspendedState` (feature `trust`) avec le lien vers la décision : la page ne demande pas un fil que l'api refuserait, d'après `trust.suspended` de `GET /v1/me`.
- La page « Modération » montre les décisions sans la liste des signalements du membre, que l'api ne donne pas pendant la suspension (question ouverte 142).
- Les points d'écriture lisent l'accès par `useAccess` : bouton inactif avec la raison du catalogue `errors`, jamais une règle locale.
- Les textes ne promettent rien que l'api refuse : la liste de ce qui reste ouvert suit `allowWhenSuspended`.

## Conséquences

- Si l'api ouvre une lecture pendant la suspension, seuls le texte et la page concernée changent.
- Le parcours est vérifié contre l'api (`e2e-live/trust.spec.ts`, qui échoue sur toute requête refusée dans la console) et sur l'api simulée (`e2e/trust.spec.ts`).
