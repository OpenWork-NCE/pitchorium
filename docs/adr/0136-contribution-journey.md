# 0136. Parcours de contribution

Statut : acceptée (2026-10-10).

## Contexte

« Contribuer » est le parcours où la confiance se gagne (§4, §9.3) : chaque montant doit être exact, chaque état vrai, et rien ne doit paraître payé avant que l'api ne l'ait confirmé. Les montants, la commission, les frais, les moyens et leurs bornes n'existent que dans l'api (ADR 0047, 0135). Le parcours doit fonctionner sur ordinateur comme sur téléphone, se reprendre, et ne jamais créer deux paiements pour une intention.

## Décision

- Une entrée « Contribuer » (feature `payments`), îlot client chargé à la demande dans le bloc financement de la page projet (vue membre), affiché en tête sur un téléphone, et sa forme courte dans la barre d'action mobile (ADR 0132), qui n'ouvre que le parcours : un seul exemplaire des dialogues. Un visiteur d'une campagne ouverte voit « Se connecter pour contribuer », qui revient au parcours après la connexion ; une campagne terminée ou gelée n'en montre aucun.
- La disponibilité est lue dans `GET .../payment-options`, jamais déduite (ADR 0138). Une contribution en attente de ce membre sur ce projet, dont la session court encore, est proposée (« Reprendre le paiement », « Abandonner ce paiement ») au lieu d'en créer une autre.
- Le parcours est un `Dialog`, tout l'écran sur un téléphone, une étape par écran et par adresse (`?contribute=<étape>`, historique du navigateur) : type (don, contrepartie, love money avec paiement, engagement de love money sans paiement), pays du paiement (prérempli par l'api), montant dans la devise proposée par l'api avec l'équivalent en euros du devis, contrepartie (seulement pour un financement avec contrepartie ; éligibilité dite par le devis, ajustement au minimum seulement dans la même devise), nom (soi ou une organisation dont on est `owner` ou `admin`), affichage public (désactivé par défaut) et don anonyme (si l'api l'autorise, pour un don), moyen de paiement, récapitulatif. Une étape dont un choix précédent manque ramène à ce choix. Les instruments jamais payés en ligne (subvention, prêt d'honneur, prise de participation, obligations convertibles) renvoient à la manifestation d'intérêt (`?interest=1`, §9.1).
- Les options sont relues 500 ms après un changement du pays, de la devise ou du montant ; le devis aussi. Le front ne calcule aucun montant : il affiche ceux du devis, en unités mineures formatées sans flottant, et n'anime un montant qu'en unités mineures entières.
- Le récapitulatif montre le devis (montant, équivalent, commission, frais estimés, montant estimé pour le porteur, devise, taux et sa date pour une devise flottante) et les mentions du §9.5, puis « Payer ». La contribution est créée avec une `Idempotency-Key` par intention (les mêmes choix gardent la même clé), un second clic pendant le premier ne fait rien, puis le navigateur rejoint la page hébergée par une navigation, après vérification de l'adresse (HTTPS, ou l'origine de l'api pour le prestataire simulé). Aucune donnée de carte ne passe par Pitchorium.
- Aucun état de paiement n'est gardé dans le stockage du navigateur : les choix vivent dans le dialogue ; une nouvelle tentative (`?from=<contribution>`) les relit dans la contribution gardée par l'api.
- La CSP n'ouvre aucune origine de prestataire : une navigation de premier niveau n'est pas soumise à `form-action`, qui revient à la seule origine (ADR 0088).
- Refus de l'api traduits par leur raison (`web.payments.problems.<code>.<reason>`, sinon `errors.<code>`), avec un lien vers l'étape à changer (contrepartie épuisée, moyen devenu indisponible, montant) ; la double authentification exigée au-delà du seuil passe par `useWithPrerequisites`.

## Conséquences

- Le parcours suit l'api : un moyen, une devise ou une borne qui change côté prestataire change l'écran sans déploiement du web.
- L'engagement de love money sans paiement est une déclaration hors plateforme (ADR 0049), confirmée par l'équipe, jamais comptée dans le collecté.
- La durée de validité d'un devis n'est pas exposée par l'api : le taux d'une devise flottante n'est verrouillé qu'à la création du paiement, pour la durée de la session (question ouverte 125).
