# 0067. Matching à règles explicables

Statut : acceptée (2026-10-08) ; règles et pondérations provisoires.

## Contexte

Le cahier des charges veut des suggestions « pas un algorithme magique, des règles lisibles » (§10.2), présentées avec une phrase de raison (§11.4), dans l'esprit du matching du prototype (besoins et casquettes, secteurs, complémentarité géographique et sectorielle, §2.1). Les règles exactes du prototype ne sont pas fournies (question ouverte 4).

## Décision

- Moteur déterministe dans le domaine (`modules/discovery/domain/matching.ts`) : chaque règle s'applique ou non, ajoute un poids fixe au score et produit une raison (clé i18n et paramètres) ; une règle compte une fois. Pondérations centralisées et versionnées (`MATCHING_RULES_VERSION`), seuil de suggestion à 20 points.
- Règles initiales, provisoires : besoin et casquette (35), mission qui répond à un besoin ou cherche une casquette (35), entrepreneurs complémentaires (30), secteur commun (20), pays dans les pays d'intervention (20), événement dans un pays du membre (20), mentorat proposé ou cherché (15), financement visé ou objectif dans le ticket, même devise (15), instruments compatibles (10), mission accessible (10), langue commune (10).
- Un volet aux détails privés ne sert qu'à son titulaire : il n'est jamais utilisé comme candidat, sa raison le révélerait.
- La réponse expose toutes les raisons, la plus lourde d'abord, et la phrase principale construite à partir des deux plus lourdes ; le texte vient du client (aucun texte localisé dans l'API).

## Conséquences

- Les règles du prototype remplaceront ces règles par une nouvelle version, sans changer le contrat de l'API.
- Le score est explicable ligne par ligne, mais ne tient compte d'aucun comportement (clics, réponses) : un apprentissage éventuel serait une décision distincte.
