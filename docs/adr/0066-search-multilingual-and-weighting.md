# 0066. Multilinguisme et pondération de la recherche

Statut : acceptée (2026-10-08).

## Contexte

Les contenus sont en français et en anglais, mais aussi en wolof, swahili, lingala ou mélangés ; la langue d'un nom propre, d'un nom d'entreprise ou d'un titre court n'est pas fiable, et PostgreSQL n'a pas de configuration de recherche pour le wolof, le swahili ou le lingala. Les recherches portent surtout sur des noms (personnes, organisations, projets), souvent saisis avec des fautes ou sans accents.

## Décision

- Configuration `simple` (sans racinisation) sur un texte normalisé `lower(unaccent(...))`, pour toutes les langues, plutôt qu'une configuration par langue : pas de détection de langue à l'indexation ni à la requête, pas de double index, mêmes résultats quelle que soit la langue de l'interface. La perte de la racinisation est compensée par la recherche en préfixe de chaque terme (`irrig:*`).
- Tolérance aux fautes sur les noms par trigrammes (`pg_trgm`, opérateur `<%`, similarité de mot 0,5, index GIN `gin_trgm_ops`).
- Libellés des codes (secteurs, pays, casquettes) indexés en français et en anglais (poids D) : « agriculture », « Senegal » ou « Sénégal » trouvent les codes correspondants.
- Pondération : A nom ou titre (1), B sous-titre (0,4), C description (0,2), D libellés (0,1) ; score = `ts_rank_cd` pondéré + 0,6 x similarité du nom + 0,4 si le nom commence par la requête. Les noms passent devant une description qui contient le mot.

## Conséquences

- « irrigations » ne trouve pas « irrigation » par le plein texte (pas de racinisation) ; il le trouve par le nom s'il y figure, ou par le préfixe « irrig ».
- Passer à des configurations par langue reste possible derrière le port (ADR 0005) : colonne de langue détectée et un `tsvector` par configuration.
- Mesure : voir le test `discovery-volume.spec.ts` (index utilisés vérifiés par `EXPLAIN`, seuil de temps documenté dans le test).
