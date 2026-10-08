# 0071. Missions bénévoles, pas de job board

Statut : acceptée (2026-10-08).

## Contexte

Le cahier des charges prévoit des « missions d'expertise packagées » (§14, V3), un journal du temps partagé pour le mentorat (§6.3, §9.4) et la disponibilité au mentorat sur le volet contributeur (§10.1). Il exclut explicitement une marketplace d'emplois : « le recruteur reste une casquette, pas un job board » (§14). Rien ne décrit une rémunération des missions (question ouverte 18).

## Décision

- Une mission est du mécénat de compétences bénévole : ni prix, ni taux, ni salaire, ni contrat dans le modèle ; aucun flux d'argent ne passe par une mission.
- Deux sens : une offre d'un contributeur portant la casquette `mentor` ou `expert` (selon le type de mission), une demande d'un entrepreneur ou de l'équipe d'un projet. La casquette `recruteur` ne permet pas de publier d'offre.
- Garde-fous : schémas stricts (un champ inconnu comme `salary` est refusé), durée bornée par le format (session de 8 h, mission courte de 80 h au plus, provisoire), refus du vocabulaire d'une offre d'emploi en français et en anglais dans les textes et les messages (`MISSIONS_JOB_POSTING_REFUSED`, liste provisoire), pas d'avis ni de notation.
- Le temps d'une mission terminée est déclaré une fois dans le journal du temps du module engagement, par sa façade, et confirmé par le bénéficiaire : il compte dans le tableau de bord d'impact comme toute heure de mentorat ou d'expertise.

## Conséquences

- Une rémunération éventuelle des missions (question ouverte 18) demanderait une nouvelle décision, un modèle de paiement et un cadre juridique propres ; elle n'est pas préparée.
- La détection lexicale est un filet, pas une garantie : la modération (module trust) reste nécessaire pour les détournements.
