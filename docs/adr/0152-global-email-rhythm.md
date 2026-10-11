# 0152. Rythme global des emails et interrupteur par type

Statut : acceptée (2026-10-11), décision du client sur la question 134.

## Contexte

L'api choisit le rythme des emails pour tous les types à la fois (un email à chaque notification, résumé quotidien ou hebdomadaire, ADR 0061) et garde, pour chaque type, un canal email activable (ADR 0060). La demande envisageait une colonne par rythme et par type ; un rythme par type demandait de changer le modèle de l'api (question 134).

## Décision

- Un rythme global pour tous les emails non transactionnels : immédiat, résumé quotidien ou résumé hebdomadaire (`emailDigest`), à l'heure et au jour donnés par l'api dans le fuseau du membre.
- Un interrupteur email par type, dans la grille des préférences ; un type transactionnel reste coché et verrouillé, avec sa raison, et part toujours aussitôt.
- Le modèle de l'api ne change pas ; la page des préférences le dit en tête de la grille.

## Conséquences

- Aucun rythme propre à un type : un membre qui veut moins d'emails d'un type le coupe, ou choisit un résumé pour tous.
- La désinscription en un clic d'un email coupe son type, ou rend le résumé à son rythme précédent (ADR 0062), sans autre réglage.
