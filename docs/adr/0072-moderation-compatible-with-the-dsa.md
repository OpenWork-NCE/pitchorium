# 0072. Modération compatible avec le DSA

Statut : acceptée (2026-10-08).

## Contexte

Le cahier des charges demande le signalement d'un profil, d'une publication, d'un projet, une modération par file et masquage (§13), un signalement de base en V1 (§14). Pitchorium héberge des contenus de tiers dans l'Union européenne : le règlement européen sur les services numériques (DSA) prévoit, selon la taille et la nature du service, un mécanisme de notification et d'action (art. 16), un exposé des motifs (art. 17), un traitement interne des réclamations (art. 20) et des rapports de transparence (art. 15 et 24). Les obligations réellement applicables sont une question juridique (question ouverte 81).

## Décision

- Notification et action : signalement par un membre de dix types de cibles, et notification de contenu illégal sans compte (explication obligatoire, déclaration de bonne foi, contact facultatif), limitée par adresse IP. Accusé de réception, puis information du notifiant sur la décision.
- Dossier unique par cible : les signalements s'y cumulent, la file est triée par une priorité documentée et explicable, la fraude sur un projet en financement en tête (de l'argent est en jeu).
- Les décisions sont prises par un humain. Elles portent un exposé des motifs (décision, faits, fondement contractuel ou légal, recours à une détection automatisée, fin éventuelle, voie d'appel), envoyé à la personne concernée par une notification transactionnelle.
- Le module trust ne modifie pas les tables des autres modules : il applique masquage, retrait et gel par leurs façades (`moderation_status`, `setFundingFrozen`), qui n'ont pas besoin de dépendre de lui.
- Réclamation interne : un appel par décision, dans un délai d'au moins six mois, revu par une autre personne que l'auteur de la décision ; une décision annulée est défaite.
- Signaux automatiques sans apprentissage automatique (volumes anormaux) : ils ouvrent un dossier, jamais une sanction.
- Message privé : le modérateur ne reçoit que le message signalé et les trois messages qui le précèdent, figés au signalement.
- Transparence : compteurs agrégés par période, sans donnée personnelle ; audit de chaque étape et de chaque lecture d'un dossier.

## Conséquences

- Un notifiant non membre ne peut pas contester un classement sans suite par l'appel interne (le DSA ouvre aussi la réclamation aux notifiants) : à confirmer avec la question juridique.
- Les durées de conservation des signalements et des décisions relèvent du registre de conservation (`docs/compliance/retention.md`).
- Les motifs, les poids de priorité, les seuils des signaux et les délais sont provisoires et configurables.
