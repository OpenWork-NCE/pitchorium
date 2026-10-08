# 0097. Mode hors ligne et rejeu des mutations

Statut : acceptée (2026-10-08), complétée par l'ADR 0102 (actions gardées après la fermeture de l'onglet).

## Contexte

Une partie des membres se connecte en 4G instable (§4). Une écriture lancée pendant une coupure ne doit ni se perdre, ni s'appliquer deux fois quand elle repart. L'api applique une écriture marquée idempotente une seule fois par clé `Idempotency-Key` (ADR 0021) ; le client du navigateur tirait une clé nouvelle à chaque requête POST.

## Décision

- TanStack Query suit l'état du réseau (`onlineManager`) : hors ligne, une mutation est mise en pause au lieu d'échouer, puis reprise à la reconnexion (mode réseau `online`, par défaut).
- `useIdempotentMutation` (`lib/query/offline.ts`) : la clé est tirée au moment où la personne agit et fait partie des variables de la mutation ; la reprise et tout nouvel essai la renvoient telle quelle, l'api rend la réponse déjà calculée (`Idempotent-Replayed`). Le client du navigateur ne tire une clé que si l'appelant n'en fournit pas.
- La coquille de l'espace membre montre une bannière hors ligne avec le nombre d'actions en attente (`usePausedMutations`), annonce le retour du réseau et le nombre d'actions envoyées.
- Les mutations en pause vivent dans l'onglet ; celles d'une liste fermée (message, réaction, commentaire) sont aussi gardées sur l'appareil (ADR 0102).

## Conséquences

- Toute écriture susceptible d'être rejouée passe par `useIdempotentMutation`.
- Le test de bout en bout « hors ligne » vérifie qu'une action faite hors ligne arrive une seule fois à l'api, avec sa clé, après la reconnexion.
- La persistance de certaines mutations au-delà de l'onglet est décidée par l'ADR 0102.
