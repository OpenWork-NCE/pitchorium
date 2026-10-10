# 0139. Présentation de la couverture et choix du versement

Statut : acceptée (2026-10-10). Applique les ADR 0133 et 0134 côté web.

## Contexte

Un porteur doit comprendre ce qui décide de ses contributions en ligne : le pays du compte bancaire qui reçoit les fonds, pas son pays de résidence ni celui du projet. Un porteur établi au Sénégal peut recevoir sur un compte en France s'il remplit les conditions du prestataire. La couverture et les conditions n'existent que dans l'api.

## Décision

- `/settings/payouts` (« Versement et vérification ») lit la couverture publique, le compte et le KYC par le serveur. Un membre à qui l'api demande d'abord autre chose (`GET /v1/me/prerequisites/payment.payout.configure` : volet entrepreneur, adresse vérifiée) lit ces éléments, traduits, et le chemin vers son profil.
- Couverture : pour chaque option, pays de compte acceptés, devises, moyens que ses contributeurs pourront utiliser, version et date de vérification de la matrice ; le principe est écrit en tête.
- Choix : d'abord le pays du compte, parmi tous les pays (jamais prérempli depuis le profil), puis les options que la couverture sert dans ce pays (`lib/coverage.ts`, qui ne fait que filtrer la réponse et appliquer la règle de devise que chaque prestataire déclare). Pour chaque option : conditions et pièces traduites depuis leurs codes (portée « société » précisée), moyens des contributeurs avec leurs pays, ce que l'option ne couvre pas. Pays sans option : message honnête, la liste des pays couverts pour un porteur qui y détient un compte, et les alternatives qui restent ouvertes (love money, intérêt, hors plateforme).
- Case à cocher explicite « Je confirme remplir les conditions… », envoyée comme `eligibilityConfirmed: true` ; la même option reprend le compte existant (lien d'onboarding renouvelé par l'api).
- Changement par `PUT`, après l'explication de ses conséquences (nouveau compte, pays d'un compte Stripe jamais modifiable, ancien compte gardé pour les contributions reçues) ; un refus actuel de l'api (`changeRefusal`) désactive l'action avec sa raison ; `ACCESS_REAUTHENTICATION_REQUIRED` propose de se reconnecter et revient à la page.
- Onboarding hébergé (Stripe) : l'adresse de retour est cette page ; l'état est relu une fois à l'arrivée (`POST .../refresh`) et sur demande.
- KYC par revue manuelle : pièces privées (`verification_document`), certification, état, motif d'un refus et nouvelle soumission. `kyc_verified` et `payout_account` refusés ailleurs ouvrent un prérequis qui mène à cette page (ADR 0105).

## Conséquences

- Une option ajoutée ou retirée de la matrice apparaît ou disparaît sans changer le web.
- Le compte d'une organisation n'existe pas encore (question 121) : la page ne concerne que la personne.
