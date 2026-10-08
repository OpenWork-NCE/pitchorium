# 0099. Cadre membre sans barre inférieure

Statut : acceptée (2026-10-08), complétée le 2026-10-08 (revue de design : bandeau et colonnes sur téléphone).

## Contexte

Le cahier des charges (§6.1, §6.2) écarte la barre d'onglets basse du prototype : un réseau professionnel se pilote par un bandeau web, avec la recherche globale toujours visible et l'action de publication selon le contexte. Sur un téléphone, la même information s'empile, sans imiter une application native. Le cadre doit aussi porter les compteurs en temps réel, les bannières de compte et le mode hors ligne (ADR 0097).

## Décision

- Un bandeau haut collant pour l'espace membre (`components/layout/member`) : symbole de la marque vers l'accueil, recherche globale, puis, à partir de `lg`, les six sections (Accueil, Réseau, Projets, Messages, Notifications, Profil), l'action contextuelle (Publier ou Créer un projet, sous `Can`) et le menu du compte.
- Sous `lg`, aucune barre inférieure : un bouton Menu, qui porte le total à traiter, ouvre les sections dans un panneau (`Drawer`) ; la recherche reste au bandeau (un champ, puis une icône sous `sm`). Le focus revient au bouton à la fermeture.
- Les compteurs (messages, notifications, invitations) arrivent avec la page puis suivent Socket.IO ; une hausse est annoncée (`aria-live` poli), et le nom accessible du lien contient le nombre (« Messages, 2 messages non lus »).
- Sous le bandeau, les bannières de compte (conditions à accepter, adresse à vérifier, suspension, double authentification d'un rôle d'administration) et la bannière hors ligne.
- Mise en page en trois colonnes à partir de `xl` (3, 6, 3 sur la grille de 12), deux à partir de `lg` (8 et 4, colonne latérale collante), une seule en dessous ; dans le DOM, le contenu principal vient en premier.
- Le cadre d'administration garde une navigation latérale (une feuille sur un téléphone) et un fil d'Ariane ; le rôle est vérifié par le serveur, sinon la page n'existe pas (404).

## Complément de la revue de design (PROMPT FRONT 2A)

- Sous `lg`, Messages et Notifications restent au bandeau, en icônes avec leurs compteurs ; le panneau du menu garde les autres sections, les projets suivis, l'action et le compte. Le bouton Menu ne porte plus de total.
- Les colonnes latérales ne s'empilent plus sous le contenu : sous `lg`, la page reprend leur contenu dans son flux (le fil : la complétion du profil en tête, les suggestions parmi les éléments, `docs/design/patterns.md`).
- Au-dessus du fil, aucun grand titre visible : un `h1` masqué, et le composeur « Commencer une publication ».

## Conséquences

- Aucune action n'est fixée en bas de l'écran : le contenu garde toute la hauteur utile ; sur un téléphone, ce qui est à traiter (messages, notifications) reste à un geste, le reste derrière le bouton Menu.
- Une section ajoutée passe par `NAV_ITEMS` (lien, raccourci `g` puis une lettre, ADR 0098) et doit tenir dans le bandeau à `lg` ; au-delà de six, la navigation est à revoir.
- Les compteurs exigent une connexion temps réel par onglet ; sans elle, ils gardent la valeur du premier rendu.

## Mesures

- JavaScript initial compressé (Brotli, framework compris) : 201,8 kB pour un budget de 250 kB (ADR 0094) ; 308 kB dans la première version du cadre, 233,9 kB après avoir sorti du premier chargement la palette, l'aide des raccourcis, les infobulles, le panneau mobile et sonner, puis le menu du compte et les schémas du temps réel. Sur l'exécuteur de la CI GitHub, environ huit fois plus lent qu'un poste rapide, la version à 233,9 kB dépassait le TBT de 300 ms (de 413 à 421 ms) : d'où ce dernier report.
- Lighthouse mobile sur `/fr/feed` (session de l'api simulée, 4G lente, processeur ralenti quatre fois) : performance 100, accessibilité 100, bonnes pratiques 100, LCP 1,5 s, TBT de 11 à 24 ms (55 ms avant le dernier report).
