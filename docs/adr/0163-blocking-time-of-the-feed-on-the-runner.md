# 0163. Total Blocking Time du fil mesuré sur le runner

Statut : acceptée (2026-10-12).

## Contexte

Le Total Blocking Time de `/fr/feed` échouait en CI seulement (265 à 278 ms, puis 251 à 293 ms au niveau 3 du 2026-10-11, pour un seuil de 250 ms exigé à chaque passage), alors que le JavaScript de la page était identique avant et après le FRONT 8A-R. Lighthouse calibrait le ralentissement du processeur sur un seul passage de l'accueil (`benchmarkIndex`), puis jugeait chaque passage du fil seul.

Mesure sur le runner (workflow `diagnose.yaml`, suite `lighthouse`, `scripts/ci/lighthouse-series.sh`), dix passages du fil par commit, sur le même runner, ralentissement commun de 4,3 :

- `c0a5941b`, dernier commit vert avant le 8A-R : 210, 208, 220, 169, 189, 183, 178, 155, 146, 143 ms ; médiane 180,5, de 143 à 220, écart interquartile 44,8 ;
- `bc7e7ec7`, état du 8A-R : 189, 167, 181, 147, 171, 254, 181, 174, 177, 192 ms ; médiane 179, de 147 à 254, écart interquartile 15,3.

Les deux séries sont équivalentes : aucune régression du code. Un passage isolé dépasse 250 ms (254) sans changement de code, et l'indice du processeur varie de 9 % d'un passage à l'autre sur le même runner (3 774 à 4 506), d'où des ralentissements calibrés de 3,3 à 5,7 d'un run à l'autre.

## Décision

- Le ralentissement est calibré sur la médiane de trois mesures de l'indice du processeur, et non plus sur une seule.
- Le Total Blocking Time du fil est jugé sur la médiane de trois passages (`aggregationMethod: 'median'`). Au niveau 2, où chaque page a un passage, le fil en reçoit deux de plus (`scripts/lighthouse.sh`).
- Le seuil reste 250 ms.

## Conséquences

- Le niveau 2 dure environ une minute de plus (deux passages du fil et deux mesures de calibration).
- Une régression réelle déplace la médiane : la série de dix passages se rejoue par `gh workflow run diagnose.yaml -f suite=lighthouse -f page=/fr/feed -f repeat=10 -f refs='<avant> <après>'`.
