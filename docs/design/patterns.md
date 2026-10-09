# Usages

Comment assembler les composants (`components.md`) pour les situations récurrentes, dans le cadre de `direction.md`.

## Formulaires et erreurs (ADR 0096)

- Un formulaire repose sur un schéma de `@pitchorium/contracts` : `useZodForm(schema)` le valide dans le navigateur avec les messages de `web.forms` (jamais les textes anglais de Zod), l'api le valide à nouveau. Une règle que l'api vérifie sur l'ensemble (la fin d'un événement suit son début) est reprise par un raffinement de `lib/forms/rules.ts` (`endsAfterStart`), qui nomme son message.
- Chaque champ est un `FormField` (libellé, description, erreur, compteur) ; les champs sont obligatoires sauf mention « facultatif » (`optional`), et le formulaire le dit une fois en tête quand il en a plusieurs.
- Une valeur facultative laissée vide est absente (`undefined`), pas une chaîne vide : le schéma de l'api refuse souvent une chaîne vide (`min(1)`).
- Validation au premier départ du champ (`onTouched`), puis à chaque saisie. À l'envoi en échec, un résumé apparaît en tête du formulaire et prend le focus : son titre compte les erreurs (« Le formulaire contient 2 erreurs. »), puis chaque erreur est un lien « Libellé : message » qui place le focus sur son champ (le premier segment d'un groupe).
- Messages précis et actionnables, du plus précis au plus général : message du champ (`web.forms.fields.<champ>.<code>` : la règle attendue, les domaines autorisés, comme `linkedin.com` ou `https://` seulement), message de la règle d'un raffinement (`web.forms.rules.<règle>`, « La fin doit être après le début. »), puis message du code avec ses bornes formatées dans la langue de la page (`web.forms.issues`, « Raccourcissez ce texte à 10 000 caractères au plus. »). Un texte vide qui échoue à un motif est un champ à renseigner.
- Réponse de l'api : `useApplyProblem(form, { fields })` place chaque erreur de champ (`errors[].pointer` du RFC 9457) sous son champ, avec les bornes et le format que le schéma du formulaire donne pour ce champ (l'api ne transmet que le code) ; un code de l'api qui concerne un champ (`EVENTS_SCHEDULE_INVALID` pour `endsAt`) va sous ce champ avec son message (`web.forms.problems.<code>`) ; tout autre problème devient l'erreur du formulaire (`errors.<code>`), avec sa référence `X-Request-Id`. Le résumé reprend alors le focus. Un problème réseau reste à l'appelant (hors ligne : plus bas).
- Compteur de caractères : affiché à partir de 80 % de la limite, ou tant que le focus est dans le champ ; nombres formatés dans la langue de la page ; annoncé (`aria-live` poli) seulement près de la limite.
- Le bouton d'envoi passe en `loading` (même largeur) pendant l'appel ; il n'est jamais désactivé pour cause de champs invalides : l'envoi montre les erreurs.
- Actions du formulaire (`FormActions`) : l'action principale d'abord dans le document ; sur un téléphone, empilées en pleine largeur, l'action principale en haut ; à partir de `sm`, en ligne, alignées à droite, l'action principale à droite.

## Authentification (§7, ADR 0104)

- Écran partagé sur un ordinateur (`AuthFrame`) : panneau de marque à gauche, violet, motif d'élévation, promesse du §3 révélée en D4 ; le formulaire à droite. Sur un téléphone, une colonne, le formulaire d'abord. Langue et thème toujours dans le bandeau.
- Un écran, une question : titre, phrase d'explication, formulaire, puis les liens secondaires. Boutons des fournisseurs pleine largeur, logo officiel à gauche, « Continuer avec … » ; l'email en lien secondaire.
- Un message ne révèle jamais l'existence d'un compte (« Si un compte utilise … ») ; une limite de fréquence dit son délai ; un lien expiré dit sa durée de validité et propose d'en recevoir un autre.
- Attributs des gestionnaires de mots de passe : `username` et `current-password` à la connexion, `email`, `name` et `new-password` à l'inscription et à la réinitialisation (avec un champ `username` caché).

## Onboarding (§7.2)

- `Stepper` des trois étapes en tête ; les conditions sont obligatoires (trois cases, liens vers les textes), l'intention et le profil se passent (« Passer » en action discrète à côté de l'action principale).
- Le profil s'enregistre champ par champ, au départ du champ : la barre de force, calculée par l'api, avance à chaque champ rempli.

## Paramètres

- Navigation par sections à gauche (en haut sur un téléphone), une adresse par section ; chaque bloc est une carte avec son titre et ce qu'il fait.
- Une action impossible dit pourquoi (« C'est votre seule méthode de connexion … ») au lieu d'un bouton désactivé muet ; une action sensible redemande le mot de passe.

## Fil d'actualité (§10.3)

- Pas de grand titre visible au-dessus du fil : un `h1` masqué visuellement (« Accueil ») ; la place est prise par le composeur « Commencer une publication » (coquille, la publication arrive au PROMPT FRONT 4).
- Sur un grand écran, la complétion du profil est la colonne gauche, les suggestions la colonne droite. Sous `lg`, la complétion du profil devient un module en tête du fil (tant que le profil est incomplet), et les suggestions des modules parmi les éléments : trois personnes après le troisième élément, puis trois tous les dix éléments (`FEED_MODULES`, `features/content`), tant qu'il en reste ; un fil plus court se termine par un module.
- Les éléments que le web ne dessine pas encore (actualité de projet, événement) sont laissés de côté, comme le contrat le demande d'un type inconnu.
- Pages suivantes par « Afficher plus » (`Pagination`), la fin annoncée ; la phrase de raison d'une suggestion est construite par la page avec les catalogues `discovery` et `reference` (`useSuggestionReason`).

## Conversation (§10.4)

- Un séparateur par jour, dans le fuseau du membre : « Aujourd'hui », « Hier », puis la date (jour de la semaine, jour et mois, l'année si elle diffère) ; c'est un titre, pour s'y rendre au lecteur d'écran.
- Les messages consécutifs d'un même auteur écrits à moins de 5 minutes d'intervalle (`GROUP_GAP_MINUTES`, `lib/format/message-groups.ts`) forment un groupe : l'avatar de l'autre une seule fois, en bas du groupe, un espacement resserré, les coins du côté de l'auteur moins arrondis à l'intérieur du groupe.
- Sous le dernier message d'un groupe, l'heure courte de la langue (« 14:32 », « 2:32 PM »), la date complète en infobulle au survol et au focus. Sous le dernier message envoyé : « Lu » quand l'autre participant l'a lu (`lastReadSequence`), « Envoyé » sinon.
- Zone de saisie : elle grandit avec le texte jusqu'à six lignes puis défile ; un bouton joint un fichier ; Entrée va à la ligne, le bouton d'envoi (ou Ctrl Entrée, Cmd Entrée) envoie.

## Notifications (§10.5)

- Une colonne média de largeur fixe (48 px) aligne tous les textes : un avatar, ou deux en chevauchement réduit avec un liseré ; l'icône du type en pastille dans leur coin.
- La phrase vient du namespace `notifications` (partagé avec les emails), en gras tant qu'elle n'est pas lue ; une notification sur une publication montre son début entre guillemets (`excerpt` de l'api, deux lignes au plus).
- Toute la ligne ouvre la cible ; une demande de connexion s'accepte ou s'ignore sur place (« Accepter », « Ignorer »), la réponse remplace les boutons et est annoncée.

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
- Un message, une réaction ou un commentaire faits hors ligne survivent à la fermeture de l'onglet (ADR 0102) : gardés sur l'appareil pour le membre qui les a faits, 24 heures au plus, ils partent à la prochaine ouverture de l'espace membre en ligne, une seule fois ; la déconnexion les efface.

## Confirmation destructrice

- Une action qui supprime, retire ou publie de façon définitive passe par `AlertDialog` : un titre qui nomme l'objet, ce qui va se passer et ce qui ne pourra pas être défait, un bouton qui dit le verbe (« Supprimer le projet »), Annuler focalisé d'abord.
- Une action irréversible sur un objet important (supprimer un projet, un compte) demande en plus de saisir une phrase (le nom de l'objet) : l'action reste indisponible, avec sa raison, jusqu'à la saisie exacte.
- Une action annulable ne se confirme pas : elle s'exécute et propose « Annuler » dans un toast.

## Autorisations et prérequis

- Complétion au fil de l'eau (ADR 0105) : une écriture passe par `useWithPrerequisites` ; refusée pour des éléments manquants, le formulaire de chacun s'ouvre dans un dialogue (une feuille sur un téléphone), puis l'action repart seule. « Plus tard » rend le refus.
- L'api décide à chaque appel (`ACCESS_PREREQUISITES_MISSING`, `FORBIDDEN`) ; l'interface s'informe par `GET /v1/me/prerequisites/{action}` pour ne pas proposer une impasse.
- `Can` ou `useAccess(action)` (feature `access`) : `mode="hide"` retire une action que la personne ne peut pas obtenir (administration) ; `mode="disable"` l'affiche désactivée avec sa raison (`disabledReason` : « À compléter d'abord : adresse email vérifiée ») quand elle peut la débloquer.
- Pendant la lecture des prérequis, une action en `disable` reste active (l'api tranchera), une action en `hide` reste cachée.
- Un refus de l'api malgré une indication favorable s'affiche comme toute erreur : son code traduit, et le lien vers ce qu'il faut compléter.

## Comptes et bannières

Bannières de l'espace membre, de la plus grave à la moins grave, une seule action chacune : compte suspendu (vers la décision et l'appel), conditions à accepter (vers l'étape de l'onboarding, puis retour à la page), adresse email à vérifier (renvoi sur place), double authentification exigée par un rôle, prérequis manquants, hors ligne. Elles lisent `GET /v1/me` et l'état du réseau ; aucune ne bloque la navigation.
