# 0076. Traduction à la demande des contenus

Statut : acceptée (2026-10-08).

## Contexte

Le cahier des charges prévoit en V3 un bouton « Traduire » sur les contenus des membres, avec la mention « Traduction automatique », jamais silencieuse (§8.3, §14) ; DeepL est souvent meilleur que Google sur le français et l'anglais (§8.2). Un contenu envoyé à un prestataire sort de la plateforme, et chaque caractère est payant.

## Décision

- Traduction seulement sur action d'un membre (`POST /v1/translations`), vers une locale d'interface active ; un message seulement pour un participant de la conversation. La réponse porte toujours `machineTranslated: true`, la langue source, le prestataire et la clé de la mention à afficher.
- Port `TranslationProvider` : DeepL (API v2, glossaire métier transmis pour les paires qui le permettent), Google Cloud Translation Basic (v2) en complément ou en secours, prestataire simulé hors production ; ordre fixé par `LOCALIZATION_PROVIDERS`. Langues de chaque prestataire vérifiées dans sa documentation et gardées en configuration avec leur source et leur date (`domain/provider-languages.ts`).
- Les modules propriétaires des contenus enregistrent leurs sources traduisibles auprès de localization (inversion de dépendance) : chacun applique ses règles de visibilité ; localization ne lit aucune table d'un autre module.
- Cache par contenu et locale cible, valable tant que l'empreinte SHA-256 du texte original ne change pas (une modification l'invalide) et pendant `LOCALIZATION_CACHE_TTL_DAYS` ; les messages ne sont jamais mis en cache.
- Coûts : limite de caractères par membre et par jour, plafond mensuel de la plateforme (`LOCALIZATION_MONTHLY_CAP_REACHED` au-delà), alerte à 80 % (métrique `pitchorium.localization.cap.warning`), compteur `pitchorium.localization.characters`.
- Glossaire FR et EN stocké comme donnée (`localization.glossary_terms`), termes par défaut insérés au démarrage du worker, traductions marquées provisoires.

## Conséquences

- Le prestataire de traduction est un sous-traitant (registre des traitements).
- Une course entre deux traductions simultanées peut dépasser le plafond de quelques caractères.
- Google Cloud Translation ne traduit pas le wolof, contrairement au tableau du §8.2 (question ouverte 87).
