# 0054. Tests contre les sandboxes des prestataires

Statut : acceptée (2026-10-07).

## Contexte

Les adaptateurs Stripe et Flutterwave lisent des champs précis des réponses (sessions, transactions, frais, remboursements, litiges et rétrofacturations, listes paginées). Les tests d'intégration les exercent contre des serveurs HTTP qui reproduisent ces API d'après leur documentation : un écart entre la documentation et l'API réelle n'y apparaît pas.

## Décision

- Suite `pnpm test:providers` (`apps/server/test/providers`, `vitest.providers.config.mts`), distincte des tests d'intégration : elle appelle les vraies API en mode test et vérifie la forme exacte des réponses que lisent les adaptateurs (type JSON de chaque champ, nombres lus sans flottant), en passant par les adaptateurs eux-mêmes quand c'est possible.
- Clés : `STRIPE_TEST_SECRET_KEY` (`sk_test_`), `FLUTTERWAVE_TEST_SECRET_KEY` (`FLWSECK_TEST`), et facultativement `STRIPE_TEST_CONNECTED_ACCOUNT`, un compte connecté de test déjà activé (sans lui, les paiements de test passent par le compte de plateforme et la session Checkout n'est pas testée). Une clé de production est refusée. Sans aucune clé, la commande l'annonce et s'arrête avec le code 0.
- Stripe : compte connecté (création, lien d'activation, état), session Checkout relue, paiement par carte de test, frais du `balance_transaction`, liste des charges, remboursement et sa relecture, litige ouvert par la carte `pm_card_createDispute`, secret d'un endpoint de webhook créé dans la sandbox et vérification d'une signature calculée avec lui. Les objets créés (compte, endpoint, session) sont fermés, supprimés ou expirés à la fin ; le sous-compte Flutterwave de test, unique par compte bancaire, est supprimé avant et après la création.
- Flutterwave : sous-compte (supprimé à la fin) et lien de paiement Standard partagé, liste et vérification des transactions existantes, liste des rétrofacturations et des remboursements, taux indicatif, notification documentée vérifiée par `verif-hash`.
- Marquage : tout objet créé par la suite chez un prestataire (compte connecté, endpoint de webhook, paiement Stripe, sous-compte Flutterwave) porte la métadonnée `pitchorium_test=provider-tests` (`test/providers/marker.ts`), posée à la création (Flutterwave efface `meta` à toute modification d'un sous-compte). `pnpm providers:cleanup` ferme ou supprime ces objets, et eux seuls, après un arrêt brutal de la suite.
- Compte connecté de test : `pnpm providers:stripe-test-account` le crée par Accounts v2 avec la même configuration que l'adaptateur et la métadonnée `pitchorium_test=checkout-account` (jamais nettoyé), affiche le lien d'onboarding hébergé avec les données de test officielles de Stripe, puis `--check <acct>` vérifie que les paiements sont activés avant de le déclarer dans `STRIPE_TEST_CONNECTED_ACCOUNT` (`apps/server/.env` et secret GitHub).
- CI : job `provider-sandboxes`, dont les étapes ne s'exécutent que si le secret GitHub `STRIPE_TEST_SECRET_KEY` ou `FLUTTERWAVE_TEST_SECRET_KEY` existe (un secret ne peut pas conditionner un job entier).

## Conséquences

- Un écart constaté se corrige dans l'adaptateur et dans le faux serveur des tests d'intégration.
- Non couverts : la livraison réelle des webhooks (aucune URL publique en CI), le paiement d'une session Checkout ou d'un lien Flutterwave (navigateur requis), un remboursement Flutterwave réel (transaction réussie requise).

## Exécution du 2026-10-08

Clés de test Stripe et Flutterwave disponibles (sans compte connecté de test `STRIPE_TEST_CONNECTED_ACCOUNT`). Écarts constatés et corrigés :

- Stripe refuse la création de comptes par Accounts v1 pour une nouvelle intégration : passage à Accounts v2, sans données d'identité (plateforme en France, jetons de compte exigés), ADR 0044.
- Stripe rattache la transaction de solde (frais) quelques secondes après le paiement : le test attend son rattachement ; l'adaptateur enregistrait déjà des frais connus plus tard.
- `refund_application_fee` est refusé sur une charge sans compte connecté : l'adaptateur ne l'envoie que pour une charge directe.
- Flutterwave ne renvoie pas `business_email` dans la liste des sous-comptes et répond 400 quand la liste est vide : le test supprime ses sous-comptes par compte bancaire et identifiant.

## Exécution du 2026-10-08 (suite)

- La fermeture d'un compte v2 exige `applied_configurations` (`merchant`, ou `customer` et `merchant`) : sans elle, Stripe refuse et les comptes créés par les exécutions précédentes restaient ouverts. La suite et `providers:cleanup` la transmettent ; les comptes restants ont été fermés.
- Une plateforme établie en France ne peut pas fixer `display_name` à la création d'un compte v2 (jetons de compte exigés), comme les autres données d'identité.
