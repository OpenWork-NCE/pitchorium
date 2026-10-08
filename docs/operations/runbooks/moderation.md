# Procédure de modération

1. File : `GET /v1/admin/moderation/cases` (priorité décroissante ; la fraude sur un projet en financement en tête). S'affecter le dossier (`POST .../assignment`).
2. Lire le dossier (`GET .../cases/{caseId}`, lecture auditée) : signalements, motifs, contexte limité d'un message signalé.
3. Décider (`POST .../decisions`) avec un exposé des motifs factuel, le fondement (conditions ou loi) et sa référence : classement, masquage, retrait, avertissement, suspension (au-delà de 30 jours ou définitive : administrateur), gel d'un projet (administrateur).
4. Projet frauduleux : gel, puis remboursements (`POST /v1/admin/moderation/projects/{projectId}/refunds`, administrateur, session récente) ; prévenir le juridique.
5. Appels : `GET /v1/admin/moderation/appeals` ; un autre modérateur que l'auteur tranche, avec une motivation.
6. Contenu manifestement illégal (pédocriminalité, terrorisme) : retrait immédiat et signalement aux autorités selon la procédure validée par le juridique (question 81).
7. Transparence : `GET /v1/admin/moderation/transparency` pour le rapport périodique.
