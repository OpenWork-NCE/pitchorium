# 0061. Digests et fuseaux horaires

Statut : acceptée (2026-10-08).

## Contexte

Le §10.5 prévoit un digest quotidien facultatif, le §14 un digest hebdomadaire. Les membres vivent de Port-au-Prince à Nairobi en passant par Paris : un digest à 8 h UTC arriverait la nuit pour une partie d'entre eux.

## Décision

- Fuseau IANA du membre dans identity : lu à l'inscription dans l'en-tête `X-Time-Zone` envoyé par l'application web, `UTC` sinon, modifiable dans les préférences.
- Réglage `emailDigest` : `off`, `daily` ou `weekly` (le lundi). Avec un digest, les emails non transactionnels attendent le digest ; les transactionnels partent aussitôt.
- Tâche toutes les 15 minutes : un digest part à partir de l'heure `NOTIFICATIONS_DIGEST_HOUR` locale, une fois par jour local (ou par lundi local), avec les notifications en attente ; les heures sont calculées par `Intl.DateTimeFormat`, changements d'heure compris.
- Un membre qui revient à `off` ne reçoit pas les notifications en attente par email : elles restent dans l'application.

## Conséquences

- La précision de l'envoi est d'un quart d'heure.
- L'heure et le jour sont provisoires (`docs/open-questions.md`).
