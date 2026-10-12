# 0167. Interface de la traduction à la demande

Statut : acceptée (2026-10-12).

## Contexte

Le cahier des charges (§8.3) prévoit la traduction des contenus des membres à leur demande, jamais silencieuse. L'api traduit (`POST /v1/translations`), met en cache, applique la limite quotidienne du membre et le plafond mensuel, et donne la langue de chaque contenu (`language`, détectée par le noyau quand elle n'est pas déclarée).

## Décision

- « Traduire » n'est proposé qu'à un membre connecté, pour un contenu dont la langue est connue et diffère de celle de la page (`useTranslationOffered`) : publication, commentaire, présentation d'un profil, récit et actualités d'un projet, événement, mission, message.
- La traduction remplace le texte sur place, par un fondu enchaîné (`.cross-fade`, état final immédiat avec moins de mouvement), avec la mention « Traduction automatique (prestataire) » et un bouton pour revenir à l'original ; le format du texte (Markdown) est conservé.
- Un message n'est traduit que par l'action « Traduire » de son menu, jamais automatiquement, et la traduction n'est pas gardée au-delà de la conversation ouverte.
- Le code de la traduction (`Translated`) est chargé à la première demande ; un refus (limite atteinte, prestataire indisponible) s'affiche à la place du bouton avec son texte du catalogue `errors`.

## Conséquences

- Une nouvelle surface traduisible enveloppe son texte dans `Translatable` avec la source et la langue données par l'api.
- Les parcours (publication, message à la demande seulement, limite atteinte) sont vérifiés contre l'api avec le prestataire simulé (`e2e-live/trust.spec.ts`).
