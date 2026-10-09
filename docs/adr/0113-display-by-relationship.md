# 0113. Affichage selon la relation

Statut : acceptée (2026-10-09).

## Contexte

Une page de profil ou d'organisation se lit par un visiteur, un membre hors réseau, une relation de second degré, une connexion, son propriétaire (§10.1, §10.2, §10.7) ; chaque membre règle la visibilité de sa page publique, des détails de ses volets et de ses listes. Recalculer ces règles dans le web les dupliquerait et risquerait d'afficher ce que l'api cache.

## Décision

- L'api applique la confidentialité : la page affiche ce qu'elle reçoit, et seulement cela. Un groupe absent (volet caché, compteurs `null`, liste refusée `NETWORK_LIST_HIDDEN`) est dit comme tel, jamais reconstruit.
- Les actions dépendent de l'état reçu, pas d'une règle locale :
  - visiteur : « Se connecter pour échanger » (connexion puis retour à la page), JSON-LD de la page publique ;
  - membre : `RelationshipActions` selon `connection` (`none`, `request_sent`, `request_received`, `connected`), suivi selon `following`, menu (copier, partager, bloquer) ; ni message ni signalement avant leurs prompts ;
  - propriétaire : édition en place, force du profil, adresse et visites ;
  - organisation : « Gérer » pour `owner` et `admin` (`viewerRole`), le reste par l'api, qui refuse avec un code stable.
- Une ressource absente pour le lecteur répond 404 (ADR 0101) : profil sans page publique pour un visiteur, membre bloqué, organisation supprimée ou gestion par un non-membre.
- Indexation : seule la vue publique est indexée ; la vue membre et les pages de gestion portent `noindex`.

## Conséquences

- Un changement de règle de confidentialité ne touche que l'api.
- Les rôles d'une organisation lus dans le web (`lib/roles.ts`) ne servent qu'à montrer ou masquer un contrôle ; la règle du dernier propriétaire est annoncée avant d'être rencontrée, et l'api l'applique (`ORGANIZATIONS_LAST_OWNER`).
