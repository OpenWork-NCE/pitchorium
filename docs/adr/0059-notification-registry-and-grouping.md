# 0059. Registre et regroupement des notifications

Statut : acceptée (2026-10-08).

## Contexte

Le §10.5 liste une dizaine d'événements à notifier, et les modules existants en émettent d'autres (invitations, KYC, remboursements, journal du temps, introductions...). Un réseau social inonde vite ses membres : « Amina et 12 autres ont réagi » plutôt que treize notifications, et un membre très suivi ne doit pas bloquer le worker.

## Décision

- Registre déclaratif (`domain/notification-types.ts`) : pour chaque type, les événements source, le caractère transactionnel, la priorité, les canaux par défaut, le regroupement et la cible du lien profond ; les résolveurs de destinataires (`notification-sources.ts`) lisent les façades des modules émetteurs. Un test vérifie que chaque type des contrats est déclaré, et `i18n:check` qu'il a ses textes.
- Création idempotente par couple (source, destinataire) dans la transaction de l'inbox de l'événement ; jamais pour l'acteur, ni à travers un blocage.
- Regroupement par clé (`type:cible`, `type`, ou unique) dans une fenêtre fixe ouverte au premier événement : l'acteur passe en tête et n'est compté qu'une fois. Un verrou transactionnel par clé sérialise les événements concurrents d'un même groupe.
- Abonnés d'une cible : diffusion en lots dans une file du worker, un lot par transaction, le suivant mis en file ensuite ; un lot rejoué ne crée rien deux fois.
- Faible priorité (publications des membres suivis) : regroupée, plafonnée par membre et par jour, jamais envoyée par email immédiat.
- Chaque création ou croissance d'une notification enregistre `notifications.notification.created.v1` : la diffusion (Socket.IO, email) se fait hors de la transaction de création.

## Conséquences

- Ajouter un type : une entrée du registre, un cas du résolveur, ses textes i18n.
- Les valeurs (fenêtre, lots, plafond, canaux par défaut) sont provisoires et configurables.
