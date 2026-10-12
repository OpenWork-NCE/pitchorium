# 0172. Socle de la console d'administration

Statut : acceptée (2026-10-12).

## Contexte

La console (`(admin)`, ADR 0078) est l'outil quotidien des modérateurs et des administrateurs : elle manipule des données personnelles, de l'argent et des sanctions. Les règles et les permissions n'existent que dans l'api ; la console doit pourtant ne proposer que ce que le lecteur peut faire, demander une connexion récente pour les actions sensibles, faire confirmer l'irréversible, et rappeler que chaque lecture est inscrite au journal d'audit.

## Décision

- Capacités : le layout du groupe lit `GET /v1/admin/capabilities` avant le rendu ; l'api y décide chaque action réservée à un rôle privilégié comme le ferait un appel (`allowed`, `code`, `recentAuthentication`). `ConsoleAccessProvider` les donne aux écrans : une action que le rôle ne donne jamais (`FORBIDDEN`) est masquée, une action que le lecteur peut débloquer (deuxième facteur manquant) est désactivée avec sa raison (`errors.<code>`), une action qui demande une nouvelle connexion est proposée (`consoleActionState`, `features/admin/lib/console-access.ts`). La navigation et les raccourcis ne montrent que les écrans que le lecteur peut ouvrir ; les files du tableau de bord viennent de `GET /v1/admin/queues`, par les mêmes droits.
- Réauthentification : les actions sensibles (rôles, remboursement, flags, suspension définitive, gel d'un projet, relance d'une tâche) peuvent répondre `ACCESS_REAUTHENTICATION_REQUIRED`. `useSensitiveAction` affiche alors l'avis qui mène à la connexion, laquelle revient sur la même page avec l'action à rouvrir (`?resume=<clé>`, `useResumeEffect`) : le mécanisme de la suppression du compte. Le dialogue d'une action sensible le dit avant l'envoi (durée lue dans les capacités).
- Confirmation : une action destructrice passe par `AlertDialog` ; une action irréversible (suspension définitive, gel, publication d'une méthodologie, retrait d'une vérification) demande en plus de saisir une phrase.
- Mention d'audit : une page qui montre des données personnelles porte en permanence la mention « votre consultation est inscrite au journal d'audit » (`AdminPage audited`) ; l'api audite la lecture.
- Densité compacte (`data-density="compact"`), tableaux en chiffres tabulaires, raccourcis `g` puis une lettre et `/` pour la recherche, listés par `?` ; `noindex` sur chaque page, CSP inchangée.
- Les écrans d'un domaine vivent dans la feature de son module (`features/trust`, `features/payments`...) et importent le socle par la façade de `features/admin` ; une page compose les parties de deux features (la suspension de la fiche d'un membre vient de `features/trust`).

## Conséquences

- Aucune règle de permission n'est écrite dans le web : un écran ne fait qu'afficher la décision de l'api, qui tranche de nouveau à chaque appel.
- Une nouvelle action sensible n'a rien à ajouter côté web que son appel par `useSensitiveAction`.
