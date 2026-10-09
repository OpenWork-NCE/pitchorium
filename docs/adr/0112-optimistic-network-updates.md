# 0112. Mises à jour optimistes du réseau

Statut : acceptée (2026-10-09).

## Contexte

Se connecter, retirer une demande, accepter, suivre, retirer une connexion, débloquer : ces gestes sont fréquents et réversibles (§10.2). Attendre la réponse de l'api avant de changer le bouton rend l'interface lente sur une connexion mobile ; changer sans attendre peut afficher un état faux si l'api refuse (limite hebdomadaire, délai après un refus, blocage).

## Décision

- La relation avec un membre (`useRelationship`), l'état de suivi d'une organisation (`FollowButton`) et les listes paginées (`useCursorList.remove`) changent dès le geste, avant la réponse de l'api (`onMutate` de TanStack Query, ou retrait immédiat de la ligne).
- L'état précédent est gardé ; un refus le remet et dit la raison traduite (`errors.<code>`) dans une notification. Une fois la réponse reçue, la relation, les compteurs (`/v1/me/counters`) et les listes du réseau (racine de clés `['network']`) sont relus.
- Le calcul de l'état attendu est une fonction pure, testée (`features/network/lib/relationship.ts`, `afterAction`) ; aucune règle métier n'y figure : un état attendu faux est corrigé par la relecture.
- Les gestes irréversibles ou lourds (bloquer, supprimer une organisation, transférer la propriété) attendent la réponse : ils passent par une confirmation.
- Les annonces aux lecteurs d'écran suivent la réponse de l'api, jamais l'état optimiste.

## Conséquences

- Les boutons changent sans délai perceptible ; un refus revient en arrière en moins d'une seconde, avec sa raison.
- Les compteurs en temps réel (événement `counters`, `lib/realtime`) et la relecture après chaque geste gardent les pages cohérentes entre onglets.
- Les tests unitaires couvrent l'état optimiste et le retour arrière (`relationship-actions.spec.tsx`), les parcours réels le retour arrière d'un refus simulé.
