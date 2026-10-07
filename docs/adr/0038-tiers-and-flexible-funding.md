# 0038. Paliers cumulatifs et financement flexible

Statut : acceptée (2026-10-08). Interprétation à valider (questions ouvertes 12, 44 à 47).

## Contexte

Le prototype prévoit des « paliers indépendants » (§2.1) et la page projet montre des paliers « débloqués visuellement » (§11.2), de 1 à 5 avec un montant et un usage (§11.1). Le cahier des charges ne dit ni comment les seuils se composent, ni ce qui se passe à l'échéance (question ouverte 12).

## Décision

- Paliers cumulatifs : 1 à 5 seuils strictement croissants, positifs, chacun avec la description de l'usage des fonds ; le dernier seuil est l'objectif. Remplacer les paliers fixe l'objectif au dernier seuil, ce qui garde l'invariant sans double saisie.
- Un palier est débloqué dès que le montant collecté atteint son seuil ; la date du premier déblocage est conservée et `projects.tier.unlocked.v1` n'est émis qu'une fois. Une annulation qui repasse sous le seuil retire l'état « atteint » affiché sans effacer cette date.
- Financement flexible : à la date de fin, le projet est clôturé par une tâche planifiée ; les paliers atteints restent acquis, rien n'est remboursé automatiquement, que l'objectif soit atteint ou non (`goalReached` dans `projects.project.closed.v1`).
- L'objectif peut être dépassé : le projet passe à `funded` à l'objectif et reste ouvert aux contributions jusqu'à sa date de fin. Une annulation qui repasse sous l'objectif avant l'échéance le remet en `funding`.
- La durée (30 à 90 jours) fixe la date de fin à la publication ; il n'y a pas de prolongation.

## Conséquences

- « Paliers indépendants » est lu comme « chaque palier compte pour lui-même dès qu'il est atteint » ; un modèle tout ou rien (remboursement sous l'objectif) demanderait un traitement à l'échéance dans le module payments.
- La clôture et l'annonce de fin proche sont idempotentes : la tâche relit le projet sous verrou avant d'agir.
