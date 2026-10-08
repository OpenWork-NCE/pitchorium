# 0075. Pseudonymisation des données conservées

Statut : acceptée (2026-10-08).

## Contexte

Les contributions, le ledger, les comptes de versement et le KYC relèvent d'obligations légales (comptables, lutte contre le blanchiment) dont la durée est une question juridique ; les acceptations des conditions et les décisions de modération servent de preuve ; un projet financé par d'autres membres, une conversation ou une introduction appartiennent aussi à d'autres. Les supprimer à la demande d'un membre fausserait les montants et priverait les autres de leurs données.

## Décision

- Au début de l'exécution d'une suppression, un pseudonyme aléatoire (UUID v4) est tiré et conservé dans la demande pendant l'exécution seulement ; il n'est dérivé de rien et n'est jamais associé à l'identifiant une fois la demande terminée : la pseudonymisation est irréversible.
- Les effaceurs remplacent l'identifiant du membre par ce pseudonyme là où la donnée est conservée (contributions, ledger, comptes de versement, KYC et leurs pièces, acceptations légales, décisions de modération, actualités et projets financés, messages réduits à une pierre tombale, journal d'audit), et suppriment le reste. Les montants ne changent pas.
- L'affichage d'un pseudonyme ne trouve aucun profil : l'interface affiche « Membre supprimé ».
- La liste de suppression des emails ne garde que l'empreinte SHA-256 de l'adresse, pour continuer de respecter un rebond ou une plainte.

## Conséquences

- Une pièce d'identité conservée reste une donnée personnelle même sous un pseudonyme : sa durée de conservation est une question juridique (question ouverte 85).
- Un pseudonyme commun à tous les modules garde les liens entre les données conservées d'une même personne, sans permettre de la retrouver.
