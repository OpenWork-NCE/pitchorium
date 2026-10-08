# 0079. Entrées strictes

Statut : acceptée (2026-10-08).

## Contexte

Zod 4 retire en silence les clés inconnues d'un objet. Un client qui se trompe de nom de champ (`visibilty`) obtenait un succès sans effet, et un champ réservé au serveur envoyé par erreur passait inaperçu. L'ASVS (V5.1.4) demande que les entrées soient validées strictement. Rendre chaque schéma `.strict()` aurait touché plus d'une centaine d'objets partagés entre requêtes et réponses.

## Décision

- Le pipe global `StrictValidationPipe` valide avec le contrat (nestjs-zod), puis compare le corps reçu au corps analysé : toute clé retirée par l'analyse, à toute profondeur, est refusée par `400 VALIDATION_FAILED`, code `unrecognized_keys`, avec le pointeur JSON de la clé.
- Les chaînes de requête restent tolérantes (paramètres de cache ou de suivi ajoutés par un navigateur ou un proxy).
- Chaque chaîne et chaque liste d'entrée est bornée ; `test/architecture/contracts.spec.ts` le vérifie sur le document OpenAPI.

## Conséquences

- Les contrats restent écrits avec `z.object` ; une transformation qui renommerait des clés d'un corps serait vue comme des clés inconnues (aucune aujourd'hui, les transformations portent sur des valeurs de requête).
- Le frontend doit envoyer exactement les champs du contrat ; le client Orval le garantit par ses types.
