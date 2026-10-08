# 0068. Précalcul des suggestions

Statut : acceptée (2026-10-08).

## Contexte

Calculer les suggestions à la lecture parcourrait tous les membres, projets, missions et événements à chaque affichage. Elles changent peu entre deux modifications de profil, de projet ou de mission.

## Décision

- Les suggestions sont précalculées par le worker (file `discovery.matching`) et stockées par sujet et par liste : les 50 meilleurs candidats, avec leur score et leurs raisons.
- Génération des candidats par filtres indexés avant le calcul du score : index GIN des casquettes, besoins, secteurs, pays, instruments et étiquettes ; 500 candidats au plus par liste (`CANDIDATE_CAP`).
- Mise à jour incrémentale : un changement du membre recalcule ses listes ; un changement d'un candidat recalcule sa seule ligne dans les listes des sujets qu'il concerne, trouvés par les mêmes filtres vus depuis lui (2 000 sujets au plus, `REVERSE_CAP`) ; une liste qui ne le concerne plus le perd ; un candidat désindexé quitte toutes les listes. Une reconstruction complète recalcule tout.
- À la lecture : sans le membre lui-même, ses connexions, les blocages, les candidats écartés (« pas intéressé », conservé) et ceux qui ne sont plus indexés pour les membres.

## Conséquences

- Les plafonds sont provisoires (`docs/open-questions.md`) : au-delà de 2 000 sujets concernés par un même candidat, les listes des autres se mettent à jour à la reconstruction ou à leur prochain recalcul.
- Mesure (test `discovery-volume.spec.ts`, 5 000 fiches de matching, 31 600 documents) : calcul complet des cinq listes d'un membre en 75 à 480 ms (médiane observée d'environ 130 ms) ; la requête de candidats s'arrête au plafond (`Limit`) après un `BitmapOr` d'index (`match_profiles_company_country_idx`, `match_profiles_entrepreneur_sector_idx`, index GIN selon le profil) en moins de 1 ms, vérifié par `EXPLAIN`. Seuil vérifié en CI : 3 s.
