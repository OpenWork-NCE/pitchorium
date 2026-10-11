# 0151. Horaires d'un événement dans deux fuseaux

Statut : acceptée (2026-10-11).

## Contexte

Un événement a lieu à une heure du lieu (fuseau IANA de l'événement, ADR 0069) ; ses lecteurs sont entre l'Afrique, les Caraïbes et l'Europe. Une seule heure trompe celui qui la lit dans un autre fuseau ; deux heures sans repère se confondent.

## Décision

- La page et la liste disent d'abord l'heure du lieu, nommé par sa ville (« 18:00 – 20:00 à Dakar »), puis, quand le fuseau du lecteur diffère à cette date, la même plage chez lui (« 20:00 – 22:00 chez vous »), avec le jour quand il change (« jeu. 15 oct., 03:00 – 05:00 chez vous »). Deux fuseaux de même décalage à cette date (Abidjan et Dakar) ne donnent qu'une heure.
- Le fuseau du lecteur est celui de ses préférences, sinon celui de son navigateur (cookie `pitchorium.tz`) ; inconnu à une première visite (UTC par défaut), rien n'est converti plutôt que de convertir faux.
- Règle pure et testée : `lib/format/event-times.ts` (`Intl.DateTimeFormat.formatRange`, décalages de `@internationalized/date`, heure d'été de chaque fuseau à la date de l'événement).
- Le formulaire saisit les dates sur l'horloge du lieu (`DateTimeField`, ADR 0100) et nomme le fuseau une fois (`TimeZoneSelect`).

## Conséquences

- Les données structurées (`Event`) écrivent les dates avec le décalage du fuseau de l'événement ; les fichiers ICS restent en UTC (api).
