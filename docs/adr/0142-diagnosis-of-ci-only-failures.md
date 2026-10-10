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
