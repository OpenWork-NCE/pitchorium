# 0098. Raccourcis clavier

Statut : acceptée (2026-10-08).

## Contexte

Un réseau professionnel utilisé au quotidien sur ordinateur (§4) gagne à se piloter au clavier : ouvrir la recherche, aller aux messages. Des raccourcis mal conçus piègent la saisie (une lettre tapée dans un champ qui déclenche une action) et se contredisent d'un écran à l'autre.

## Décision

- Un registre central par coquille (`ShortcutsProvider`, `useShortcut`) et un seul écouteur : une combinaison (`mod+k`, Ctrl ou Cmd selon la plateforme), une touche (`?`) ou une séquence de deux touches en moins d'une seconde (`g` puis `h`).
- Une touche seule ou une séquence ne se déclenche jamais pendant la saisie dans un champ ; une combinaison avec Ctrl ou Cmd, si.
- `?` ouvre l'aide, qui liste tous les raccourcis enregistrés avec les touches de la plateforme (`Kbd`).
- Raccourcis de l'espace membre : `mod+k` recherche globale ; `g` puis `a` accueil, `r` réseau, `p` projets, `m` messages, `n` notifications, `u` profil.

## Conséquences

- Un écran ajoute ses raccourcis par `useShortcut` ; un conflit se voit dans l'aide.
- Aucun raccourci n'est le seul chemin vers une action : la souris, le toucher et la tabulation restent complets.
