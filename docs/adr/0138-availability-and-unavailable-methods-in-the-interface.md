# 0138. États de disponibilité et moyens indisponibles dans l'interface

Statut : acceptée (2026-10-10). Applique l'ADR 0135 côté web.

## Contexte

L'api donne un code de disponibilité par projet et un motif par moyen indisponible (ADR 0135). Le web doit dire à chacun ce qu'il peut faire, sans jargon, sans promesse de date, sans recalculer une règle (ADR 0113).

## Décision

- Chaque code a sa présentation (`lib/availability.ts`) : `open`, le parcours ; `holder_not_verified`, « Les contributions en ligne ouvriront dès que le porteur aura finalisé sa vérification », alternatives proposées ; `holder_without_covered_payout_account`, « Les contributions en ligne ne sont pas encore disponibles pour ce projet », alternatives proposées, aucune date ; `campaign_closed`, état final sans action de paiement ; `funding_frozen`, « Contributions suspendues », message neutre qui ne dit pas que la campagne est terminée, sans action de paiement.
- Les alternatives sans paiement en ligne : engagement de love money (si le projet l'accepte), manifestation d'intérêt, déclaration d'une contribution hors plateforme.
- Les moyens indisponibles sont listés sobrement, chacun une fois avec le premier motif de l'api, jamais un moyen proposé dans la devise affichée, suivis de ce qui est accepté (« Mobile Money n'est pas disponible depuis ce pays (France). Accepté pour ce paiement : carte bancaire… »).
- Le rail du porteur n'est jamais nommé : le contributeur voit la devise de paiement, pas le prestataire (§9.2).
- Opérateurs de Mobile Money en codes libellés par `reference.mobileMoneyOperators`, sans logo : les règles de marque des opérateurs ne sont pas vérifiées (question ouverte 124).

## Conséquences

- Une nouvelle raison ou un nouvel état de l'api demande sa traduction et sa présentation, vérifiées par un test qui parcourt tous les codes.
