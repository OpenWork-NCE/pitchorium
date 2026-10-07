# 0037. Devise de libellé des campagnes

Statut : acceptée (2026-10-08). Répond provisoirement à la question ouverte 7.

## Contexte

Le cahier des charges exprime l'objectif d'une campagne en euros (§11.1), alors que les contributions viendront d'Europe et d'Afrique, en euros, en francs CFA ou en d'autres devises (§9.2). La conversion et son coût sont des questions ouvertes (questions 7 et 8) et relèvent du module payments.

## Décision

- Tous les montants d'un projet (objectif, seuils des paliers, minimums des contreparties, montant indicatif d'une manifestation d'intérêt, montants collectés) sont libellés en euros (`EUR`).
- Le modèle stocke la devise avec chaque montant (`currency` du projet, des contributions appliquées, des manifestations d'intérêt) et l'API expose `{ amountMinor, currency }` (ADR 0007). Toute autre devise est refusée (`PROJECTS_CURRENCY_NOT_SUPPORTED`).
- `applyFunding` reçoit un montant dans la devise du projet : la conversion d'un paiement dans une autre devise est faite en amont par le module payments.

## Conséquences

- Accepter une autre devise de libellé (devise du porteur, choix par projet) ne demande pas de migration de structure : seule la règle du domaine change, et la conversion reste à définir côté payments.
- Les montants affichés en d'autres devises seront des conversions indicatives, jamais des montants de référence.
