# 0153. Calendrier personnel

Statut : acceptée (2026-10-11).

## Contexte

L'api délivre un flux iCalendar des événements où le membre est inscrit, à une adresse secrète (`POST /v1/me/event-calendar` crée ou remplace, `DELETE` révoque ; seule l'empreinte du jeton est gardée, ADR 0069). Elle ne dit pas si une adresse existe.

## Décision

- Paramètres, section « Calendrier » (`/settings/calendar`) : créer l'adresse, puis l'afficher une seule fois, dans un champ à copier, sous un avertissement : quiconque la connaît voit les inscriptions sans se connecter. Régénérer (confirmé : l'ancienne cesse de fonctionner) et révoquer (confirmé) restent toujours proposés, l'api ne disant pas si une adresse existe.
- Instructions d'abonnement pour Google Agenda, Apple Calendrier et Outlook, en texte, sans script ni lien profond vers ces services.
- Sur la page d'un événement : le fichier ICS de l'événement (avec le lien de connexion pour un inscrit ou un organisateur, par l'api) et un lien Google Agenda construit dans la page (`lib/calendar-links.ts`), sans le lien de connexion.

## Conséquences

- Une adresse perdue ne se retrouve pas : on la régénère.
