# 0129. Façade de la vidéo d'un projet

Statut : acceptée (2026-10-10)

## Contexte

Un projet peut avoir une vidéo YouTube ou Vimeo (ADR 0039, adresse validée par l'api, `youtube-nocookie.com` ou `player.vimeo.com` avec `dnt=1`). Un lecteur intégré charge des centaines de kilo-octets de scripts tiers et dépose des traceurs dès l'affichage de la page, sans clic.

## Décision

- `VideoFacade` (`features/projects/components/page/video-facade.tsx`, testé) affiche une façade : le visuel principal du projet (aucune vignette chargée chez YouTube ou Vimeo, ce qui serait déjà une requête tierce), un bouton de lecture nommé par le titre du projet et la mention de l'hébergeur ; l'iframe, en mode respectueux de la vie privée et en lecture automatique, n'est insérée qu'au clic.
- CSP : `frame-src` limité à `https://www.youtube-nocookie.com` et `https://player.vimeo.com` (plus Turnstile), aucun ajout à `script-src` ni à `img-src`. Une restriction par page a été écartée : la CSP est posée par le proxy à la première requête et la navigation côté client garde celle de la page d'entrée, une vidéo ouverte après une navigation serait bloquée.
- L'aperçu de l'assistant (étape Médias) montre la même façade.

## Conséquences

- Aucun octet ni cookie tiers avant un clic ; la page reste dans son budget (`check:bundles`).
- Un autre hébergeur demande une règle de l'api (ADR 0039) et une origine de plus dans `frame-src`.
