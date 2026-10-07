# 0019. Transactions courtes autour des appels externes

Statut : acceptée (2026-10-07). Remplace la transaction par requête de l'ADR 0013.

## Contexte

Chaque requête `/v1/auth` s'exécutait dans une seule transaction (ADR 0013) pour que les écritures de Better Auth et les événements identity de l'outbox soient validés ensemble. Cette transaction restait ouverte pendant les appels réseau : échange du code OAuth, lecture du profil fournisseur et des clés JWKS, vérification Have I Been Pwned. Un fournisseur lent retenait donc une connexion PostgreSQL et des verrous, au risque d'épuiser le pool.

Les hooks de base de données de Better Auth 1.7 ne suffisent pas à garder l'atomicité sans cette transaction : la partie `after` d'un hook s'exécute après la validation de la transaction de Better Auth (`queueAfterTransactionHook`), et la partie `before` ne connaît ni l'identifiant généré ni le résultat de l'écriture.

## Décision

- Aucune transaction ne couvre une requête `/v1/auth` ; une transaction ne contient que des écritures en base et l'outbox, jamais d'appel réseau.
- L'adaptateur Drizzle de Better Auth est enveloppé (`withIdentityEvents`) : chaque écriture (`create`, `update`, `updateMany`, `delete`, `deleteMany`) s'exécute avec l'événement identity qu'elle produit dans une même transaction courte. L'événement est déduit du modèle écrit, des données et du chemin de la requête (par exemple suppression de sessions sur `/revoke-other-sessions`).
- Les transactions que Better Auth ouvre lui-même (inscription par email, création d'un compte OAuth, consommation d'un jeton de vérification) deviennent des transactions du `TransactionManager` (`transaction: true`, `db.transaction` redirigé) : leurs écritures et leurs événements restent atomiques.
- Have I Been Pwned est appelé dans un hook `before` de Better Auth, avant l'endpoint et hors de toute transaction, et non dans le hachage du mot de passe (le plugin de Better Auth l'appelle depuis l'inscription, donc dans sa transaction). La vérification échoue ouverte : un service injoignable, trop lent (délai de 3 secondes) ou qui répond une erreur laisse passer le mot de passe, avec un log `warn` et la métrique `pitchorium.identity.pwned_check.unavailable` (attributs `reason` : `timeout`, `unreachable`, `http_error`, et `path`). Refuser l'inscription chaque fois qu'un service tiers est indisponible bloquerait l'entrée sur la plateforme (§4, entrer en moins d'une minute) pour une protection complémentaire de la longueur minimale de 12 caractères ; la métrique permet d'alerter sur une indisponibilité prolongée.
- Les emails restent envoyés après la réponse, et jamais pour une réponse 5xx.

## Conséquences

- Une requête d'authentification n'emprunte une connexion que le temps d'une écriture : vérifié par `test/integration/auth-transactions.spec.ts`, qui bloque l'échange OAuth et Have I Been Pwned et constate qu'aucune connexion n'est empruntée ni aucune transaction ouverte.
- L'atomicité est garantie par écriture (et par transaction de Better Auth), plus par requête : une requête qui échoue après une première écriture validée ne l'annule pas. Better Auth ne fait plusieurs écritures dépendantes que dans ses propres transactions.
- La correspondance entre écritures et événements dépend des chemins et des modèles de Better Auth : une montée de version de Better Auth doit repasser les tests d'intégration identity.
- Règle générale pour les autres modules : un use case qui appelle un service externe (stockage, antivirus, fournisseur de paiement) le fait hors de `TransactionManager.run`, puis ouvre une transaction courte pour écrire le résultat et ses événements.
