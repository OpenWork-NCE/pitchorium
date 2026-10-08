# 0073. Suspension d'un compte

Statut : acceptée (2026-10-08).

## Contexte

Le module access prévoyait un niveau de confiance `suspended` derrière un port (`AccountStatusProvider`), sans implémentation. Une suspension doit empêcher d'agir sans priver le membre de ses droits : connaître la décision, la contester, récupérer ou supprimer ses données (RGPD).

## Décision

- Le module trust enregistre la source de suspension auprès de access au démarrage (`registerAccountStatusSource`), comme payments le fait pour le KYC : access ne dépend pas de trust.
- Toute action est refusée à un membre suspendu (`ACCESS_ACCOUNT_SUSPENDED`), sauf celles marquées `allowWhenSuspended` : compte, préférences, conditions, situation de modération, appel, export et suppression des données. La connexion reste possible.
- Au début d'une suspension, toutes les sessions du membre sont révoquées : les appareils ouverts perdent leur accès, le membre se reconnecte pour lire l'avis.
- Un modérateur suspend jusqu'à `TRUST_MODERATOR_MAX_SUSPENSION_DAYS` jours ; une suspension plus longue ou définitive est réservée aux administrateurs (question ouverte 19).
- Fin : échéance (tâche planifiée), levée motivée, ou appel accueilli ; un événement en porte la cause.

## Conséquences

- La suspension est vérifiée à chaque autorisation (une requête indexée par requête authentifiée).
- Les contenus d'un membre suspendu restent visibles tant qu'aucune décision ne les masque.
