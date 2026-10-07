# 0049. Contributions hors plateforme

Statut : acceptée (2026-10-07).

## Contexte

Le repli « je verse en dehors de la plateforme, l'entrepreneur confirme » reste pour les espèces, le virement institutionnel, le mécénat de compétences et le love money sans argent (§9.3). Le prototype confirmait des fonds sur simple case à cocher, ce qui contredit « l'argent est réel, ou il n'est pas affiché » (§4).

## Décision

- Une contribution hors plateforme est déclarée par le contributeur, ou par un propriétaire du projet pour un membre, puis confirmée ou rejetée par l'autre partie.
- Espèces et virements portent un montant en EUR, XOF ou XAF (conversion exacte) ; l'engagement de love money et le mécénat de compétences n'en portent jamais.
- Un montant n'entre dans le collecté et le déblocage des paliers qu'après validation par un administrateur, sur pièce justificative privée (média `verification_document`) : écriture `offline_validated` et `applyFunding`. Avant, il est affiché à part comme déclaré.
- Les engagements de love money confirmés sont comptés et affichés comme engagements (`commitmentCount`), jamais comme montants.

## Conséquences

- Le collecté ne contient que de l'argent passé par un prestataire ou validé sur pièce.
- La portée juridique de la validation reste à préciser (`payments-compliance.md`, §7).
