# 0100. Champ de date et d'heure

Statut : acceptée (2026-10-08).

## Contexte

Le premier champ de date (`DateTimeInput`) reposait sur les contrôles natifs `date` et `time` : leur format suit la langue du navigateur, pas celle de l'application (un navigateur anglais montrait « mm/dd/yyyy » et « 06:00 PM » à un membre qui lit Pitchorium en français), leur rendu varie selon la plateforme, leur texte était coupé dans une colonne étroite, et la mention du fuseau se répétait sous chaque champ. Un événement se saisit à l'heure du lieu (Dakar) et se stocke en instant.

## Décision

- `DateTimeField` (`components/ui/date-time-field.tsx`) : un groupe (`role="group"`, nommé par le libellé du `Field`) de segments, chacun un `spinbutton` (`aria-valuenow`, `aria-valuetext`, bornes). Ordre, séparateurs et cycle horaire viennent de la langue de l'application par `DateFormatter` (`@internationalized/date`) : jour, mois, année et 24 heures en français, mois, jour, année et 12 heures avec AM et PM en anglais, quel que soit le navigateur.
- Clavier : chiffres (passage au segment suivant dès qu'aucun autre chiffre ne peut suivre, l'année à quatre chiffres), flèches haut et bas en boucle dans les bornes, Page haut et bas par pas larges, Début et Fin, Retour arrière, flèches gauche et droite entre les segments. Les segments sont `contenteditable` en `inputmode="numeric"` : un téléphone ouvre le pavé numérique ; le texte d'un clavier virtuel arrive par `beforeinput`.
- Calendrier : `Calendar` (`react-day-picker`) dans un `Popover`, chargé quand la page est inactive (ADR 0094) ; légendes, jours et libellés parlés formatés par `Intl` dans la langue de la page, premier jour de la semaine de cette langue ; le focus va au jour choisi, sinon à aujourd'hui.
- Calcul calendaire et fuseaux par `@internationalized/date` (`lib/format/zoned-time.ts`) : heure murale d'un fuseau IANA vers un instant (désambiguïsation `compatible` : une heure sautée au passage à l'heure d'été avance, une heure répétée prend sa première occurrence), jours du mois, décalage. La logique des segments est pure (`lib/format/date-segments.ts`) et testée.
- Fuseau : affiché une seule fois, à côté des dates, par `TimeZoneSelect` (« Dakar, GMT+0 », ville tirée de l'identifiant IANA, décalage à la date saisie), modifiable en cherchant une ville ou une région parmi les fuseaux du moteur (`Intl.supportedValuesOf`). Changer de fuseau garde l'heure murale et donne un autre instant.
- Versions figées : `@internationalized/date` 3.12.4, `react-day-picker` 10.0.2 (dépend de `date-fns`, utilisé seulement par la grille).

## Conséquences

- Aucun contrôle natif de date dans l'application ; la valeur reste un instant ISO 8601 en UTC, comme l'attendent les contrats.
- Le nom de ville d'un fuseau est celui de l'identifiant IANA (« London », pas « Londres ») : `Intl` ne fournit pas de nom de ville localisé.
- Le texte de l'interface du champ (segments, gabarits « jj/mm/aaaa », calendrier, fuseau) est dans `web.ui.dateTime`, `web.ui.calendar` et `web.ui.timeZone`.
