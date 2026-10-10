# 0140. Affichage des données bancaires

Statut : acceptée (2026-10-10).

## Contexte

Le prestataire simulé et Flutterwave demandent les coordonnées bancaires du porteur dans Pitchorium, transmises au prestataire et jamais conservées par l'api (ADR 0045). Le navigateur ne doit pas en garder de trace ni les exposer à un regard par-dessus l'épaule.

## Décision

- Champs sans autocomplétion (`autocomplete="off"`, sans correcteur), dans l'état mémoire du formulaire seulement : jamais dans `localStorage`, IndexedDB, l'adresse ni un brouillon ; effacés dès que l'api a répondu.
- Avant l'envoi, un récapitulatif montre le numéro de compte et le numéro Mobile Money masqués : seuls les quatre derniers caractères restent lisibles, un numéro de quatre caractères ou moins est entièrement masqué (`lib/masking.ts`, testé). « Modifier les coordonnées » revient aux champs.
- L'api ne renvoie jamais ces données : après l'envoi, la page ne montre que le prestataire, le pays et la devise du compte.

## Conséquences

- Un porteur relit ses coordonnées avant l'envoi sans les exposer en clair dans le récapitulatif.
