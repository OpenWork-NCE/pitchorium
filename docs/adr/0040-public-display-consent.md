# 0040. Consentement d'affichage public du porteur et de l'équipe

Statut : acceptée (2026-10-08)

## Contexte

La page projet est publique et partageable (§11.2) et montre le porteur et l'équipe. Or le profil d'un membre est privé par défaut (ADR 0017) : sa page publique est désactivée tant qu'il ne l'active pas. Afficher son nom, sa photo et son titre sur une page publique sans son accord contredirait ce choix.

## Décision

- Publier un projet exige le consentement explicite du propriétaire qui publie (`publicDisplayConsent: true`, littéral dans le contrat) : la page affiche publiquement son nom, sa photo et son titre, même si sa page de profil personnelle reste privée. Le consentement est enregistré sur le projet (date, auteur), sur sa ligne d'équipe, et au journal d'audit.
- Un membre invité consent pour lui-même en acceptant l'invitation (`publicDisplayConsent: true`).
- La page publique ne montre que les membres actifs qui ont consenti ; l'aperçu d'un brouillon, réservé à l'équipe, montre tous les membres actifs. La photo d'un membre sans page publique reste servie par URL présignée courte (ADR 0026).

## Conséquences

- Le consentement porte sur la carte (nom, photo, titre) affichée par le projet, pas sur le profil : le profil complet reste soumis à ses propres réglages.
- Le retrait du consentement passe par le départ de l'équipe ; un propriétaire unique ne peut pas partir (`PROJECTS_LAST_OWNER`).
