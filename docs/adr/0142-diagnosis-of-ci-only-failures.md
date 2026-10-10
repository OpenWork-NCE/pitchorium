# 0142. Diagnostic des échecs propres à la CI

Statut : acceptée (2026-10-10).

## Contexte

Des parcours du niveau 3 échouaient en CI et passaient sur le poste (Firefox : test de mention de `content.spec.ts`, 42 `console.error: Error` ; WebKit : `TypeError: Load failed`). Relancer ou ajouter un délai masque la cause ; reproduire en local ne reproduit pas le runner (deux processeurs, UTC, autres polices, latence).

## Décision

- Un workflow manuel `diagnose.yaml` répète un parcours sur le runner (`--repeat-each`, 30 par défaut, sans relance), dans un moteur choisi, avec trace et vidéo de chaque échec et les journaux de la pile, après un rapport de l'environnement du runner. Ses entrées passent au shell par des variables, jamais interpolées.
- `PLAYWRIGHT_TRACE` et `PLAYWRIGHT_VIDEO` remplacent les modes d'enregistrement des suites ; `scripts/e2e-live.sh` les transmet à l'image Playwright.
- Le garde de la console ajoute à chaque erreur le détail des objets `Error` qu'elle a reçus (nom, message, code, pile), pour que Firefox ne réduise plus une erreur à « Error ».
- Une correction n'est acceptée qu'avec 30 passages consécutifs sur le runner, sans relance.

## Conséquences

- Un échec propre à la CI se lit dans une trace du runner, pas dans une hypothèse.
- Le workflow coûte des minutes de CI : il ne tourne qu'à la main.
- Premier cas (2026-10-10) : le détail des erreurs a montré `MISSING_MESSAGE: web.profile.edit (fr)` et la trace du runner l'ordre des requêtes (1 échec sur 30 sous Firefox). Le parcours de la mention attendait une adresse `/fr/…` que la page de connexion satisfait déjà : le profil s'ouvrait avant la réponse de la connexion, rendu pour un visiteur, puis les requêtes suivantes, avec la session, rendaient l'éditeur du propriétaire dans les messages du visiteur. Correction : attendre le fil, comme les autres parcours.
