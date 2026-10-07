# 0042. Vidéo intégrée des projets

Statut : acceptée (2026-10-08). Complète l'ADR 0024.

## Contexte

Une page projet peut montrer une vidéo (§11.1), mais Pitchorium n'héberge pas de vidéo (ADR 0024). Intégrer un lecteur tiers dépose par défaut des traceurs, et une URL libre ouvrirait la porte à l'intégration de n'importe quelle page.

## Décision

- Seuls YouTube et Vimeo sont acceptés, en https : pages, liens courts et URL d'intégration (`youtube.com/watch`, `youtu.be`, `shorts`, `embed`, `youtube-nocookie.com` ; `vimeo.com/<id>[/<hash>]`, `player.vimeo.com/video/<id>[?h=<hash>]`). Toute autre forme répond `PROJECTS_VIDEO_URL_INVALID`.
- L'identifiant est validé (11 caractères `[A-Za-z0-9_-]` pour YouTube, chiffres pour Vimeo, empreinte hexadécimale pour un lien Vimeo privé) ; seuls le fournisseur, l'identifiant et l'empreinte sont stockés, jamais l'URL donnée.
- L'API renvoie l'URL d'intégration respectueuse de la vie privée : `https://www.youtube-nocookie.com/embed/<id>` ou `https://player.vimeo.com/video/<id>?dnt=1` (avec `&h=<hash>` pour un lien privé).

## Conséquences

- Le frontend intègre l'URL reçue dans un `iframe` dont l'origine est connue ; sa politique de sécurité de contenu peut se limiter à ces deux origines.
- Un autre fournisseur s'ajoute dans `domain/video.ts`, avec sa forme d'intégration sans traceur.
