# Usages

Comment assembler les composants (`components.md`) pour les situations récurrentes, dans le cadre de `direction.md`.

## Formulaires et erreurs (ADR 0096)

- Un formulaire repose sur un schéma de `@pitchorium/contracts` : `useZodForm(schema)` le valide dans le navigateur avec les messages de `web.forms.issues` (jamais les textes anglais de Zod), l'api le valide à nouveau.
- Chaque champ est un `FormField` (libellé, description, erreur, compteur) ; les champs sont obligatoires sauf mention « facultatif » (`optional`), et le formulaire le dit une fois en tête quand il en a plusieurs.
- Une valeur facultative laissée vide est absente (`undefined`), pas une chaîne vide : le schéma de l'api refuse souvent une chaîne vide (`min(1)`).
- Validation au premier départ du champ (`onTouched`), puis à chaque saisie ; à l'envoi, le premier champ invalide prend le focus et un résumé (« Le formulaire contient 2 erreurs ») est annoncé (`role=alert`).
- Réponse de l'api : `useApplyProblem(form)(error)` place chaque erreur de champ (`errors[].pointer` du RFC 9457) sous son champ, traduite depuis son code ; tout autre problème devient l'erreur du formulaire (`errors.<code>`), avec sa référence `X-Request-Id`. Un problème réseau reste à l'appelant (hors ligne : plus bas).
- Le bouton d'envoi passe en `loading` (même largeur) pendant l'appel ; il n'est jamais désactivé pour cause de champs invalides : l'envoi montre les erreurs.

## Chargement

- Premier rendu par le serveur : la page arrive remplie, sans squelette.
- Données chargées dans le navigateur : `Loading` (région annoncée « Chargement en cours ») autour de `Skeleton` de la forme exacte du contenu (mêmes hauteurs, mêmes colonnes) ; aucun décalage quand le contenu arrive.
- Page qui attend sa navigation : `loading.tsx` du groupe, barre fine sous le bandeau.
- Action en cours : `Button` en `loading`, ou `Spinner` dans une zone de moins de 48 px. Jamais de voile bloquant sur toute la page.

## Vide

- `EmptyState` : ce qui manque, pourquoi, et l'action qui le remplit quand la personne peut agir (« Écrire à une connexion »).
- Vide de premier usage (rien encore) et vide de filtre (rien ne correspond) se distinguent : le second propose d'élargir les filtres.
- Dans une carte ou un tableau, `size="inline"`, sans le motif.

## Erreur

- Une partie de page qui n'a pas pu charger : `ErrorState` à sa place, avec « Réessayer » (relance de la requête) et la référence ; le reste de la page reste utilisable.
- Toute la page : `error.tsx` du groupe (vue chargée à la demande, ADR 0094), signalée à Sentry quand il est configuré.
- Le texte vient du code (`errors.<code>`), jamais du `title` ou du `detail` techniques de l'api.

## Hors ligne (ADR 0097)

- La coquille de l'espace membre suit l'état du réseau (`useOnline`) : une bannière discrète « Vous êtes hors ligne » apparaît, annoncée, sans bloquer la lecture des données déjà chargées.
- Une écriture faite hors ligne n'échoue pas : la mutation est mise en pause par TanStack Query, la bannière compte les actions en attente, puis tout repart à la reconnexion (« Connexion rétablie, 1 action envoyée »).
- Une écriture rejouable passe par `useIdempotentMutation` : sa clé `Idempotency-Key` est tirée au moment de l'intention et voyage avec la mutation en pause ; rejouée, elle porte la même clé, et l'api ne l'applique qu'une fois.
- Les lectures ne se relancent pas en boucle hors ligne ; elles se rafraîchissent au retour du réseau.

## Confirmation destructrice

- Une action qui supprime, retire ou publie de façon définitive passe par `AlertDialog` : un titre qui nomme l'objet, ce qui va se passer et ce qui ne pourra pas être défait, un bouton qui dit le verbe (« Supprimer le projet »), Annuler focalisé d'abord.
- Une action irréversible sur un objet important (supprimer un projet, un compte) demande en plus de saisir une phrase (le nom de l'objet) : l'action reste indisponible, avec sa raison, jusqu'à la saisie exacte.
- Une action annulable ne se confirme pas : elle s'exécute et propose « Annuler » dans un toast.

## Autorisations et prérequis

- L'api décide à chaque appel (`ACCESS_PREREQUISITES_MISSING`, `FORBIDDEN`) ; l'interface s'informe par `GET /v1/me/prerequisites/{action}` pour ne pas proposer une impasse.
- `Can` ou `useAccess(action)` (feature `access`) : `mode="hide"` retire une action que la personne ne peut pas obtenir (administration) ; `mode="disable"` l'affiche désactivée avec sa raison (`disabledReason` : « À compléter d'abord : adresse email vérifiée ») quand elle peut la débloquer.
- Pendant la lecture des prérequis, une action en `disable` reste active (l'api tranchera), une action en `hide` reste cachée.
- Un refus de l'api malgré une indication favorable s'affiche comme toute erreur : son code traduit, et le lien vers ce qu'il faut compléter.

## Comptes et bannières

Bannières de l'espace membre, de la plus grave à la moins grave, une seule action chacune : compte suspendu (avec la voie d'appel), conditions à accepter, adresse email à vérifier, prérequis manquants, hors ligne. Elles lisent `GET /v1/me` et l'état du réseau ; aucune ne bloque la navigation.
