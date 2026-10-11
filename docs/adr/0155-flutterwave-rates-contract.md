# 0155. Contrat du taux indicatif de Flutterwave

Statut : acceptée (2026-10-11).

## Contexte

Le devis d'une contribution en devise flottante fige un taux de Flutterwave (ADR 0046). Depuis le 2026-10-11, le bac à sable répond « Please specify a valid Amount » à `GET /v3/transfers/rates`. Contrat vérifié dans la documentation officielle (developer.flutterwave.com/v3.0/reference/check-transfer-rates et /v3.0/docs/transfer-rates) : `GET`, paramètres `amount` (entier, montant reçu dans la devise de destination), `destination_currency`, `source_currency` ; réponse `rate` (unités de destination par unité source, nombre binaire), `source.amount` (montant débité dans la devise source) et `destination.amount`.

Deux constats :

- L'adaptateur lisait `rate` comme des unités de la devise par euro ; c'est l'inverse (des euros par naira, `0.0006...`). Le serveur simulé reproduisait la même erreur.
- Le bac à sable refuse tout montant, l'exemple de la documentation compris (`amount=1000&destination_currency=USD&source_currency=NGN`), avec la clé de test comme avec la clé de démonstration ; la variante en `POST` de l'API v4 demande des identifiants OAuth que le projet n'a pas.

## Décision

- L'adaptateur demande le montant source de 1 000 euros (`amount=1000`, destination `EUR`) et calcule les unités par euro en arithmétique décimale exacte : `source.amount` décalé de trois rangs (`unitsPerEurFrom`). `rate` n'est jamais lu. Une réponse pour une autre destination ou un autre montant est refusée.
- Le serveur simulé de l'intégration suit le contrat documenté (montant entier exigé, `source.amount`, `rate` dans le sens de la documentation).
- Le test du bac à sable n'est ignoré, avec son motif, que si le bac à sable refuse aussi l'exemple de la documentation : la panne est alors chez Flutterwave, jamais comptée comme une réussite.

## Conséquences

- Les devis en devise flottante portent un taux exact, à cinq décimales.
- Tant que le bac à sable refuse son propre exemple, la lecture du taux réel n'est pas prouvée contre Flutterwave (question 136) ; le reste de l'adaptateur l'est.
