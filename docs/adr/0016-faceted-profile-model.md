# 0016. Modèle de profil à volets

Statut : acceptée (2026-10-07)

## Contexte

Le rôle n'est plus un mur à l'inscription : un compte peut être entrepreneur, contributeur, les deux, ou ni l'un ni l'autre au départ, et préciser ses casquettes à tout moment (cahier des charges §5, §7.2).

## Décision

- Un profil de base par compte (clé : identifiant utilisateur), créé automatiquement et de façon idempotente à l'inscription.
- Deux volets optionnels et indépendants, chacun dans sa table : entrepreneur et contributeur. Chaque volet a un minimum à sa création (entrepreneur : entreprise, secteur, stade, pays de l'entreprise ; contributeur : au moins une casquette et le type de structure) ; les autres champs se complètent ensuite.
- L'intention d'arrivée est une donnée d'orientation, jamais un droit.
- Les volets servent de prérequis aux actions qui en ont besoin (`project.publish` exige le volet entrepreneur).
- Les montants (financement visé, ticket) sont en unités mineures avec devise ISO 4217 (ADR 0007).

## Conséquences

- Le profil se complète progressivement ; la force du profil guide sans bloquer.
- Les pages organisation (prompt suivant) remplaceront le nom d'organisation en texte libre du volet contributeur par une liaison.
