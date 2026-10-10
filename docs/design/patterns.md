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

- Écran partagé sur un ordinateur (`AuthFrame`) : panneau de marque à gauche, violet profond dans les deux thèmes (`brand-panel`), motif d'élévation, promesse du §3 révélée en D4 (« Afrique–Diaspora » jamais coupé au tiret, taille réglée pour tenir dans le panneau) ; le formulaire à droite. Sur un téléphone, une colonne, le formulaire d'abord et le panneau juste après, sans vide. Un seul logo : les fonds discrets du kit portent leur propre logotype, la colonne du formulaire garde le fond uni. Langue et thème toujours dans le bandeau.
- Entrée : les fournisseurs activés puis « Continuer avec un email », quatre boutons de même poids, sans liens empilés. L'étape email (`/sign-in/email`) envoie un lien de connexion par défaut, valable pour une connexion comme pour une inscription, la même réponse pour toute adresse ; « Utiliser un mot de passe » mène à `/sign-in/password` (mot de passe oublié, création d'un compte avec mot de passe). Sans fournisseur, l'étape email est l'entrée.
- Un écran, une question : titre, phrase d'explication, formulaire, puis au plus deux liens secondaires sur une ligne. Double authentification : « Vérifier » de la largeur des six cases, juste dessous.
- Un message ne révèle jamais l'existence d'un compte (« Si un compte utilise … ») ; une limite de fréquence dit son délai ; un lien expiré dit sa durée de validité et propose d'en recevoir un autre.
- Attributs des gestionnaires de mots de passe : `username` et `current-password` à la connexion, `email`, `name` et `new-password` à l'inscription et à la réinitialisation (avec un champ `username` caché).

## Onboarding (§7.2)

- `Stepper` des trois étapes en tête ; les conditions sont obligatoires (trois cases, liens vers les textes), l'intention et le profil se passent (« Passer » en action discrète à côté de l'action principale).
- Le profil s'enregistre champ par champ, au départ du champ : la barre de force, calculée par l'api, avance à chaque champ rempli.

## Paramètres

- Navigation par sections à gauche (en haut sur un téléphone), une adresse par section ; chaque bloc est une carte avec son titre et ce qu'il fait.
- Une action impossible dit pourquoi (« C'est votre seule méthode de connexion … ») au lieu d'un bouton désactivé muet ; une action sensible redemande le mot de passe.
- Une session se décrit par son type d'appareil (icône et libellé), son navigateur, son système et sa dernière activité, jamais par un lieu : l'adresse IP n'est pas géolocalisée (ADR 0107).

- « Confidentialité et réseau » : chaque réglage s'applique dès qu'il change (interrupteur, liste), s'affiche avant la réponse et revient si l'api refuse ; un déblocage dit ce qui ne revient pas (connexions et suivis retirés par le blocage).

## Profils et organisations (§10.1, §10.7, ADR 0113)

- L'en-tête porte couverture, photo ou logo, nom, titre ou type, lieu, langues, liens et badge ; la page affiche ce que l'api donne au lecteur, un groupe caché est dit comme tel, jamais reconstruit.
- Le propriétaire modifie chaque partie en place, dans un dialogue (feuille du bas sur téléphone) ; la force du profil mène directement à la partie à compléter ; un changement d'adresse montre la nouvelle adresse et explique la redirection de l'ancienne.
- Une image (photo, logo, couverture) se cadre dans le navigateur au ratio de sa place, puis s'envoie avec sa progression sur un anneau et ses vérifications (ADR 0111).
- Organisation : création guidée en deux étapes (identité, présentation), gestion par onglets (page, membres, vérification) ; la règle du dernier propriétaire est annoncée avant d'être rencontrée ; la suppression demande de saisir le nom.
- Un nom de membre dans une liste ouvre son aperçu au survol et au focus (`MemberHoverCard`) ; le lien reste le premier accès.

## Relations (§10.2, ADR 0112)

- Un seul bouton de connexion change d'état : « Se connecter » (dialogue avec une note de 300 caractères au plus), « En attente » (retirer la demande), « En relation » (retirer la connexion) ; une demande reçue donne « Accepter » et « Ignorer ». « Suivre » est à côté, puis un menu « Plus d'actions » (copier le lien, partager, bloquer).
- Chaque geste réversible s'affiche aussitôt et revient avec sa raison si l'api refuse ; bloquer, retirer une connexion, transférer ou supprimer passent par une confirmation.
- Ni message ni signalement depuis un profil avant leurs prompts (PROMPT FRONT 6 et 8).

## Suggestions (§10.2, ADR 0067)

- Chaque suggestion porte son action : « Se connecter » pour une personne (demande de connexion, prérequis complétés sur place), « Suivre » pour une organisation ou un projet ; puis « Pas intéressé », exécuté aussitôt et annulable depuis le toast (`notify.undoable`).
- La phrase de raison ne répète pas le nom affiché juste au-dessus et reste neutre en genre : des propositions courtes jointes par « · » (« Propose du mentorat · secteur commun : Énergie »), libellés courts des secteurs.

## Données de référence

- Un secteur a un libellé court (`reference.sectorsShort`, « Énergie ») dans les puces, les cartes et les phrases de suggestion, et son libellé complet (`reference.sectors`) en infobulle, pour les lecteurs d'écran et sur les pages de détail. Libellés courts provisoires (question 110).
- Une liste au milieu d'une phrase passe par `formatList` (`lib/format/list.ts`, `Intl.ListFormat`) : conjonction de la langue, libellés en minuscules (« photo et photo de couverture »), sigles et noms à capitale intérieure gardés.

## Fil d'actualité (§10.3, ADR 0032, 0117, 0121)

- Pas de grand titre visible au-dessus du fil : un `h1` masqué visuellement (« Accueil ») ; la place est prise par « Commencer une publication », qui ouvre le composeur (aussi depuis « Publier » du bandeau, `/feed?compose=1`).
- Sur un grand écran, la complétion du profil est la colonne gauche, les suggestions la colonne droite. Sous `lg`, la complétion du profil devient un module en tête du fil (tant que le profil est incomplet), et les suggestions des modules parmi les éléments : trois personnes après le troisième élément, puis trois tous les dix éléments (`FEED_MODULES`, `features/content`), tant qu'il en reste ; un fil plus court se termine par un module.
- Motif WAI-ARIA `feed` : chaque entrée est un article focalisable avec sa position ; Page suivante, Page précédente d'un article à l'autre, Ctrl Fin et Ctrl Début pour en sortir. Les pages suivantes arrivent quand la fin approche, « Afficher plus » reste pour le clavier, la fin est annoncée. Liste virtualisée dans le flux, position rendue au retour arrière (ADR 0121).
- Éléments : publication, repartage (le commentaire puis l'original intégré ; « Cette publication n'est plus disponible. » quand l'original ne l'est plus), mise en avant (« À la une »), actualité de projet (carte simple, sans lien avant le PROMPT FRONT 5A), suggestion (avec sa raison) ; un événement attend le PROMPT FRONT 7 ; un type inconnu est laissé de côté et signalé à Sentry, jamais une erreur à l'écran.
- Nouvelles publications : une pastille « N nouvelles publications » glisse du haut quand le réseau a publié (vérifiée chaque minute, onglet visible et hors économie de données) ; rien ne s'insère sans geste ; au clic, les nouvelles arrivent en tête, le défilement va à elles et le focus à la première (ADR 0117).
- Fil vide : l'état vide dit pourquoi et propose « Trouver des personnes » (page Réseau) ; un réseau trop petit est complété par les mises en avant puis les suggestions de l'api, jamais par un fil mondial anonyme.

## Publication (§10.3)

- En-tête : avatar, nom avec son aperçu au survol (membre), titre, temps relatif (date complète en infobulle), icône de l'audience avec son nom pour les lecteurs d'écran, « modifiée » ; le menu « Plus d'actions » à droite.
- Texte coupé après six lignes avec « voir plus » ; mentions liées aux profils et organisations ; adresses externes en `rel="noopener noreferrer nofollow ugc"`, dans un nouvel onglet.
- Images : 1 dans son ratio (entre 4:5 et 16:9), 2 côte à côte, 3 dont la première haute, 4 et plus en grille de quatre dont la dernière dit « +N » ; chargées à l'approche de l'écran sur un fond sobre, avec leur texte alternatif (« Image sans description » sinon). Chaque image ouvre la visionneuse à sa place (transition partagée sobre, clavier, balayage, compteur, texte alternatif écrit sous l'image, Échap rend le focus à la miniature).
- Document : miniature de la première page, titre, nombre de pages ; « Ouvrir » et « Télécharger » demandent une adresse signée à l'instant (fichier privé). Lien : la carte d'aperçu avec l'image importée par la plateforme. Projet rattaché : `ProjectCard` compacte, sans lien avant le PROMPT FRONT 5A.
- Sous le contenu : le résumé des réactions (ouvre qui a réagi, un onglet par réaction), le nombre de commentaires (ouvre le fil des commentaires) et de repartages ; puis Réagir, Commenter, Repartager.
- Réagir : un clic donne « J'aime » ou reprend la réaction donnée ; les quatre réactions apparaissent au survol après un court délai, à l'appui long sur un écran tactile, et dans le menu de la flèche au clavier ; tout s'affiche aussitôt et revient avec la raison si l'api refuse.
- Plus d'actions : enregistrer, masquer de son fil (annulable depuis le toast), copier le lien, partager (Web Share sur un téléphone) ; pour l'auteur, modifier, couper ou rouvrir les commentaires, statistiques (membres uniques par jour), supprimer après confirmation. « Envoyer en message », « Signaler » et « Traduire » arrivent avec leurs prompts (PROMPT FRONT 6 et 8).
- Repartage : un commentaire facultatif et l'audience ; celles qui élargiraient l'audience de l'original ne sont pas proposées, et le dialogue dit pourquoi.
- Contenu masqué par la modération : son auteur, seul à la voir encore, lit la mention « Contenu retiré » (`Notice`) en tête.
- Visiteur : la publication publique sans actions, avec « Se connecter pour réagir » qui ramène à la publication.

## Commentaires (§10.3)

- Du plus ancien au plus récent, dix par dix (« Charger plus de commentaires ») ; les réponses sur un seul niveau, ouvertes à la demande.
- Zone de saisie avec les mentions (`@` et quelques lettres, flèches, Entrée ou Tab, Échap), compteur près de la limite, « Publier » ou Ctrl Entrée ; une réponse commence par la mention de l'auteur du commentaire.
- Modifier (auteur), supprimer (auteur, ou auteur de la publication) après confirmation ; réagir à un commentaire comme à une publication ; « Les commentaires sont désactivés. » à la place de la zone de saisie.

## Composeur (§10.3, ADR 0118 à 0120, 0122)

- Un dialogue sur un ordinateur, tout l'écran sur un téléphone ; l'éditeur se charge à l'ouverture seulement.
- Texte de 3 000 caractères (compteur), retours à la ligne, liens reconnus, mentions par `@` ; langue déclarée ou « Détection automatique » ; audience `Membres` par défaut, `Public` indisponible sans page publique, avec la raison et le lien vers les paramètres de confidentialité.
- Jusqu'à neuf images, réorganisées en glissant, au clavier (Espace sur la poignée puis les flèches) ou par « Déplacer avant / après » ; chacune avec son texte alternatif, demandé clairement (« Sans texte alternatif » tant qu'il manque) ; états : allègement, envoi avec sa part, vérification, refus avec sa raison, échec avec « Réessayer ». Ou un PDF avec son titre (le nom du fichier par défaut).
- Une adresse collée demande son aperçu (attente, puis la carte) ; « Retirer l'aperçu » garde le lien dans le texte. Un projet de l'équipe du membre peut être rattaché.
- Brouillon gardé sur l'appareil pendant l'écriture, retrouvé à la réouverture (« Effacer le brouillon »), effacé après la publication et à la déconnexion.
- Publier exige une adresse vérifiée : le formulaire du prérequis s'ouvre, puis la publication repart (`useWithPrerequisites`). Une publication se modifie dans le même composeur (texte, audience, langue, textes alternatifs, titre du document, commentaires) ; ses fichiers et son lien restent.

## Publication à son adresse, enregistrements, activité

- `/posts/{id}` : la publication et ses commentaires ouverts ; vue publique indexable avec ses données structurées et son image de partage, vue membre sinon, 404 pour un lecteur qui ne peut pas la voir.
- `/saved` (menu du compte) : les publications enregistrées, la dernière enregistrée d'abord.
- Page d'un membre et d'une organisation : section « Activité » avec leurs publications selon ce que l'api montre au lecteur ; un visiteur lit les premières rendues par le serveur et la suite à la demande.

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

- Un champ dont le contrôle se charge à la demande (recherche, liste) garde la forme d'un champ pendant ce temps (`FieldSkeleton` : bordure, hauteur, texte indicatif) ; les captures de revue attendent la fin des chargements différés (`aria-busy`, `data-loading`).
- Premier rendu par le serveur : la page arrive remplie, sans squelette.
- Données chargées dans le navigateur : `Loading` (région annoncée « Chargement en cours ») autour de `Skeleton` de la forme exacte du contenu (mêmes hauteurs, mêmes colonnes) ; aucun décalage quand le contenu arrive.
- Page qui attend sa navigation : `loading.tsx` du groupe, barre fine sous le bandeau. Dans l'écran partagé de l'authentification, le panneau de marque est invisible sur téléphone tant que cet état est là (`data-page-loading`) : peint sous une carte vide, il était poussé par le formulaire arrivé ensuite (décalage de mise en page de 0,33 sur un chargement sur trois en réseau lent). Invisible plutôt que retiré (`visibility`), il garde sa place et son fond, le plus grand élément de la page, se charge aussitôt (LCP inchangé).
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
- L'api décide à chaque appel (`ACCESS_PREREQUISITES_MISSING`, `FORBIDDEN`) ; l'interface s'informe par `GET /v1/me/prerequisites/{action}` pour ne pas proposer une impasse. Aucune règle de prérequis n'est écrite dans le web (ADR 0109) : ni la double authentification d'un rôle, ni le profil minimum (nom, titre, pays) qu'une demande de connexion ou un premier message hors réseau exige.
- `Can` ou `useAccess(action)` (feature `access`) : `mode="hide"` retire une action que la personne ne peut pas obtenir (administration) ; `mode="disable"` l'affiche désactivée avec sa raison (`disabledReason` : « À compléter d'abord : adresse email vérifiée ») quand elle peut la débloquer.
- Pendant la lecture des prérequis, une action en `disable` reste active (l'api tranchera), une action en `hide` reste cachée.
- Un refus de l'api malgré une indication favorable s'affiche comme toute erreur : son code traduit, et le lien vers ce qu'il faut compléter.

## Comptes et bannières

Bannières de l'espace membre, de la plus grave à la moins grave, une seule action chacune : compte suspendu (vers la notification de la décision ; le lien vers la page de l'appel n'apparaîtra qu'avec elle, PROMPT FRONT 8), conditions à accepter (vers l'étape de l'onboarding, puis retour à la page), adresse email à vérifier (renvoi sur place), double authentification exigée par un rôle, prérequis manquants, hors ligne. Elles lisent `GET /v1/me` et l'état du réseau ; aucune ne bloque la navigation.
