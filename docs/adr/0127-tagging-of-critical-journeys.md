# 0127. Étiquetage des parcours critiques

Statut : acceptée (2026-10-10).

## Contexte

L'étiquette `@critical` des parcours contre la vraie api (`apps/web/e2e-live`) désignait les parcours repris dans Firefox et WebKit : 47 des 52 parcours, exécutés à chaque push dans les trois moteurs, soit 21,6 min de Playwright sur un seul worker (job `live-tests`, 24 min). Les niveaux de vérification (ADR 0123) demandent un ensemble court de parcours bloquants à chaque push, le reste au niveau 3.

## Décision

- `@critical` désigne désormais les parcours bloquants à chaque push, exécutés dans Chromium. L'étiquette se pose sur le test (`test('…', { tag: '@critical' }, …)`), plus sur le bloc `describe`.
- Les 26 parcours retenus couvrent un chemin nominal et la règle de sécurité principale de chaque domaine livré :
  - entrée de l'authentification : étape de l'email, raison précise d'un champ refusé ;
  - inscription et onboarding : parcours complet, onboarding passé, conditions impossibles à sauter ;
  - authentification : lien magique, déconnexion puis reconnexion, réinitialisation du mot de passe, double authentification, révocation d'une session, redirection ouverte refusée, prérequis manquant ;
  - OAuth : nouveau compte, adresse non vérifiée jamais liée, adresse à vérifier ;
  - Turnstile : défi réussi sans violation de la CSP ;
  - publications : mention notifiée, réactions, commentaires, publication publique lue par un visiteur et 404 d'une publication réservée aux membres ;
  - réseau : demande acceptée, membre bloqué puis débloqué ;
  - organisations : création, invitation, rôle et propriété ;
  - profils : édition de l'en-tête, page publique fermée aux visiteurs.
- Restent au niveau 3 les variantes et les parcours les plus longs : limite de débit (68 s), cinq photos dans la visionneuse (93 s), statistiques, repartage, brouillon, PDF, aperçu de lien, accessibilité du fil, etc.
- Le paiement simulé et la messagerie n'ont pas encore de parcours web (FRONT 5) : ils sont bloquants à chaque push par la suite de bout en bout de l'api (`apps/server/test/e2e`, contribution simulée notifiée en temps réel, échange de messages). Leurs parcours web seront étiquetés `@critical` à leur livraison.
- Le niveau 3 exécute tous les parcours, étiquetés ou non, dans Chromium, Firefox et WebKit.

## Complément : services externes (2026-10-10, PROMPT FRONT 5A)

- Une panne réseau vers Cloudflare faisait échouer le niveau 3 comme un test instable de Pitchorium : les parcours Turnstile chargent le script et le cadre de Cloudflare, et l'api de l'environnement réel vérifie chaque jeton auprès de Cloudflare (création des membres d'un parcours comprise).
- Étiquette `@external` : un parcours qui dépend d'un service externe (aujourd'hui les deux parcours de Turnstile, `e2e-live/turnstile.spec.ts`). Au niveau 3, les parcours sans cette étiquette tournent dans chaque moteur sans Turnstile (`LIVE_TURNSTILE=0` : ni widget, ni appel de l'api à Cloudflare) ; ceux qui la portent ont leur job (`live-external`), Turnstile actif avec ses clés de test, dans les trois moteurs, une relance permise (un test qui ne passe qu'à la relance n'y fait pas échouer le run) et son propre rapport dans le résumé du run.
- Le niveau 2 garde le parcours `@critical` de Turnstile, avec ses clés de test.

## Conséquences

- Le push exécute environ 3 min de parcours (durées mesurées dans la CI), contre 21,6 min.
- Firefox et WebKit ne sont plus vérifiés à chaque push : une régression propre à un moteur est vue par le niveau 3, la nuit suivante ou au déclenchement manuel avant une version.
- Ajouter un parcours demande de décider de son étiquette ; un parcours sans étiquette reste vérifié chaque nuit.
