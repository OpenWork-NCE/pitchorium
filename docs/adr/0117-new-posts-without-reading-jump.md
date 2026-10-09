# 0117. Nouvelles publications sans saut de lecture

Statut : acceptée (2026-10-09).

## Contexte

Pendant qu'un membre lit son fil, son réseau publie. Insérer ces publications en tête dès qu'elles existent ferait sauter la lecture (le contenu lu descend sous le doigt ou le pointeur) ; relire tout le fil à intervalle régulier coûterait des données mobiles pour rien. Le temps réel ne pousse pas les publications du réseau (fan-out à la lecture, ADR 0032).

## Décision

- La première page du fil porte une tête (`head`, opaque) : la position de l'élément le plus récent du réseau, ou l'heure de la lecture si le réseau n'en donne aucun.
- `GET /v1/feed/newer?head=` compte les publications et repartages du réseau plus récents que cette tête, lisibles par le membre (visibilité, blocages, masquage, modération), sauf les siens (ils apparaissent quand il publie) : un nombre plafonné à 20 (`FEED_NEWER_CAP`, `capped` au-delà), sans charger aucun contenu, par le même fan-out que le fil (au plus 21 entrées d'index par auteur suivi). Les actualités de projet et les événements arrivent à la lecture suivante.
- Le web interroge cette route toutes les 60 secondes, seulement onglet visible et hors économie de données (`prefers-reduced-data`, `navigator.connection.saveData`), et une fois au retour sur l'onglet après plus de 60 secondes. Une pastille « N nouvelles publications » glisse depuis le haut, annoncée poliment ; rien n'est inséré sans geste. Au clic, la première page est relue, les éléments nouveaux sont placés en tête, le défilement va à eux et le focus au premier ; la tête est renouvelée.

## Conséquences

- La lecture ne saute jamais ; un membre voit qu'il y a du nouveau sans rien charger d'autre qu'un nombre.
- Coût : une requête légère par minute et par onglet visible, aucune en arrière-plan.
- Tests : `test/integration/content.spec.ts` (compte après la tête, publications du lecteur et réservées ignorées, plafond, tête sans élément, tête invalide), tests de la pastille dans le web et parcours réel avec deux comptes.
