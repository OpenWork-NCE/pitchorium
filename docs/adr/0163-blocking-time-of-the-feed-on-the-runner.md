# 0163. Total Blocking Time du fil mesuré sur le runner

Statut : acceptée (2026-10-12).

## Contexte

Le Total Blocking Time de `/fr/feed` échouait en CI seulement (265 à 278 ms, puis 251 à 293 ms au niveau 3 du 2026-10-11, pour un seuil de 250 ms exigé à chaque passage), alors que le JavaScript de la page était identique avant et après le FRONT 8A-R. Lighthouse calibrait le ralentissement du processeur sur un seul passage de l'accueil (`benchmarkIndex`), puis jugeait chaque passage du fil seul.

Mesure sur le runner (workflow `diagnose.yaml`, suite `lighthouse`, `scripts/ci/lighthouse-series.sh`), dix passages du fil par commit, sur le même runner, ralentissement commun de 4,3 :

- `c0a5941b`, dernier commit vert avant le 8A-R : 210, 208, 220, 169, 189, 183, 178, 155, 146, 143 ms ; médiane 180,5, de 143 à 220, écart interquartile 44,8 ;
- `bc7e7ec7`, état du 8A-R : 189, 167, 181, 147, 171, 254, 181, 174, 177, 192 ms ; médiane 179, de 147 à 254, écart interquartile 15,3.

Les deux séries sont équivalentes : aucune régression du code entre ces deux commits. Un passage isolé dépasse 250 ms (254) sans changement de code, et l'indice du processeur varie de 9 % d'un passage à l'autre sur le même runner (3 774 à 4 506), d'où des ralentissements calibrés de 3,3 à 5,7 d'un run à l'autre.

Ces dix passages étaient pourtant trop rapides : calibré sur un seul passage à froid (indice 3 180), le runner tournait ensuite à 4 200 environ, soit un téléphone émulé d'indice 977 au lieu de 740. Le niveau 3 suivant, calibré sur trois mesures (indice 2 440, ralentissement 3,3, indice des passages 2 387 à 2 476 : le téléphone de référence), mesure le fil à 297, 303 et 307 ms. La trace de ces passages nomme la cause : une tâche de 125 ms à 8,3 s, l'évaluation de Zod et des schémas du temps réel, préchargés à la première inactivité de la page depuis le FRONT 8A (pour qu'un événement arrivé hors ligne trouve leur code), soit 75 ms de blocage dans la fenêtre que Lighthouse mesure. Le fil dépassait donc sa cible au téléphone de référence avant comme après le 8A-R ; seule la calibration à froid le faisait parfois passer.

## Décision

- Les gestionnaires du temps réel (Zod et les schémas) sont chargés dix secondes après la connexion, puis à l'inactivité, hors du démarrage de la page : toujours avant la plupart des événements, et un premier événement arrivé hors ligne est déjà rattrapé à la reconnexion (FRONT 8A). Mesure locale calibrée : 150 à 159 ms, la tâche de Zod à 18 s.
- Le ralentissement est calibré sur la médiane de trois mesures de l'indice du processeur, et non plus sur une seule.
- Le Total Blocking Time du fil est jugé sur la médiane de trois passages (`aggregationMethod: 'median'`). Au niveau 2, où chaque page a un passage, le fil en reçoit deux de plus (`scripts/lighthouse.sh`).
- Le seuil reste 250 ms : il n'est pas relevé, la cause est corrigée.
- Même règle pour le Largest Contentful Paint des pages publiques de ressources, jugé sur la médiane de leurs passages, et trois passages du profil public au niveau 2 (2026-10-12) : un passage unique a mesuré 2 521 ms sur le runner, les autres passages du même code de 2 291 à 2 376 ms, comme avant ce prompt (2 306 à 2 355 ms). Le seuil reste 2 500 ms. De même pour l'accueil, trois passages au niveau 2 et la médiane : un passage a mesuré 2 002 ms, tous les autres du même code depuis ce prompt et avant lui de 1 945 à 1 989 ms ; le seuil reste 2 000 ms (question 139).

## Conséquences

- Le niveau 2 dure environ une minute et demie de plus (deux passages du fil, de l'accueil et du profil, et deux mesures de calibration).
- Une régression réelle déplace la médiane : la série de dix passages se rejoue par `gh workflow run diagnose.yaml -f suite=lighthouse -f page=/fr/feed -f repeat=10 -f refs='<avant> <après>'`.
