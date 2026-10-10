# 0145. Noms uniques des transitions de vue

Statut : acceptée (2026-10-11).

## Contexte

Les miniatures d'une publication portaient en permanence un nom de transition dérivé de la publication et de l'image (`post-<id>-<index>`). Une même publication affichée deux fois (dans le fil et dans un repartage, dans une activité et une page) portait donc deux fois le même nom, et chaque navigation, que React fait passer par l'API View Transitions (`<ViewTransition>` des groupes), capturait toutes ces miniatures : le navigateur abandonnait la transition (« Duplicate view-transition-name value while capturing old state »). La visionneuse n'était d'ailleurs pas encore chargée à sa première ouverture : rien ne recevait le nom dans le nouvel état.

## Décision

- Un nom de transition partagée est unique : dérivé de la ressource et de sa place à l'écran (`transitionName('post', id, index, useId())`, `lib/view-transitions/shared.ts`), identifiant CSS valide.
- Il n'est posé que sur l'élément qui transite et pour la durée de la transition : `startSharedTransition` le pose sur la source juste avant la capture de l'ancien état, le retire de la source dans la mise à jour, le donne au nouvel élément tant que la transition dure, puis le retire (`finished`, y compris une transition sautée, dont les promesses rejetées sont traitées). Au repos, aucun élément du document ne porte de nom ; une navigation ne capture que le contenu de la page.
- La visionneuse est attendue avant de lancer la transition (déjà chargée au survol, attendue au clavier) : elle est dans le nouvel état dès la première ouverture.
- Vérification : `watchTransitionNames` (`lib/view-transitions/check.ts`, fonctions autonomes) contrôle le document au départ de chaque transition et après sa mise à jour, et signale tout nom porté deux fois. En développement, elle écrit une erreur dans la console (`TransitionNamesWatch`, retiré du build de production) ; dans les tests de bout en bout, le garde de la console l'injecte dans chaque page et fait échouer le parcours.

## Conséquences

- Les parcours simulés et réels échouent sur un nom en double, même quand le navigateur se contente d'abandonner la transition sans erreur.
- Une nouvelle transition partagée passe par `startSharedTransition` ; un nom posé en dur dans un style est une régression que le garde signale.
