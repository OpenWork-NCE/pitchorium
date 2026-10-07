# 0054. Tests contre les sandboxes des prestataires

Statut : acceptée (2026-10-07).

## Contexte

Les adaptateurs Stripe et Flutterwave lisent des champs précis des réponses (sessions, transactions, frais, remboursements, litiges et rétrofacturations, listes paginées). Les tests d'intégration les exercent contre des serveurs HTTP qui reproduisent ces API d'après leur documentation : un écart entre la documentation et l'API réelle n'y apparaît pas.

## Décision

- Suite `pnpm test:providers` (`apps/server/test/providers`, `vitest.providers.config.mts`), distincte des tests d'intégration : elle appelle les vraies API en mode test et vérifie la forme exacte des réponses que lisent les adaptateurs (type JSON de chaque champ, nombres lus sans flottant), en passant par les adaptateurs eux-mêmes quand c'est possible.
- Clés : `STRIPE_TEST_SECRET_KEY` (`sk_test_`), `FLUTTERWAVE_TEST_SECRET_KEY` (`FLWSECK_TEST`), et facultativement `STRIPE_TEST_CONNECTED_ACCOUNT`, un compte connecté de test déjà activé (sans lui, les paiements de test passent par le compte de plateforme et la session Checkout n'est pas testée). Une clé de production est refusée. Sans aucune clé, la commande l'annonce et s'arrête avec le code 0.
- Stripe : compte connecté (création, lien d'activation, état), session Checkout relue, paiement par carte de test, frais du `balance_transaction`, liste des charges, remboursement et sa relecture, litige ouvert par la carte `pm_card_createDispute`, secret d'un endpoint de webhook créé dans la sandbox et vérification d'une signature calculée avec lui. Les objets créés (compte, endpoint, session) sont supprimés ou expirés à la fin.
- Flutterwave : sous-compte (supprimé à la fin) et lien de paiement Standard partagé, liste et vérification des transactions existantes, liste des rétrofacturations et des remboursements, taux indicatif, notification documentée vérifiée par `verif-hash`.
- CI : job `provider-sandboxes`, dont les étapes ne s'exécutent que si le secret GitHub `STRIPE_TEST_SECRET_KEY` ou `FLUTTERWAVE_TEST_SECRET_KEY` existe (un secret ne peut pas conditionner un job entier).

## Conséquences

- Un écart constaté se corrige dans l'adaptateur et dans le faux serveur des tests d'intégration.
- Non couverts : la livraison réelle des webhooks (aucune URL publique en CI), le paiement d'une session Checkout ou d'un lien Flutterwave (navigateur requis), un remboursement Flutterwave réel (transaction réussie requise).
