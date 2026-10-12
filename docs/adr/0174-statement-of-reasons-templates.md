# 0174. Modèles d'exposé des motifs

Statut : acceptée (2026-10-12).

## Contexte

Chaque décision de modération porte un exposé des motifs que la personne concernée reçoit (§13, ADR 0072) : motif, faits, fondement et sa référence, recours à une détection automatisée, voie d'appel. Les modérateurs l'écrivent pour chaque dossier ; des exposés de qualité inégale exposent la plateforme et rendent les décisions difficiles à comprendre. Le cahier des charges ne fournit ni texte type ni article des conditions d'utilisation à citer.

## Décision

- Un modèle par motif de signalement (`spam`, `harassment`, `fraud`, `illegal_content`, `misleading_information`, `intellectual_property`, `other`) et un pour le classement sans suite, dans le catalogue de l'interface (`web.admin.moderation.templates`, FR et EN). Chaque modèle nomme la cible (`{{target}}`) et finit par « Faits constatés : à préciser » : le modérateur décrit les faits.
- Le formulaire de décision part du modèle du motif choisi (`statementTemplateKey`, `features/trust/lib/statement-templates.ts`) ; tant que le modérateur n'a pas modifié le texte, changer de décision ou de motif change de modèle ; une fois modifié, le texte reste le sien. Le fondement part de la loi pour un contenu illicite, des conditions d'utilisation sinon (`defaultGround`) ; la référence reste à écrire.
- L'aperçu montre, avant l'envoi, l'exposé tel que la personne concernée le lira : le même composant que sa page « Modération » (`DecisionStatement`).
- Les modèles ne citent aucun article : les conditions d'utilisation ne sont pas encore validées (question ouverte 135). L'api garde ses bornes (20 à 5 000 caractères) et seule elle tranche.

## Conséquences

- Les modèles sont des textes d'interface, relus avec le reste du catalogue ; leur fond juridique est à valider (question ouverte 145).
- Un motif ajouté aux contrats demande son modèle : le test `statement-templates.spec.ts` vérifie que chaque motif en a un, en français et en anglais.
