# 0131. Assistant de création avec brouillon dans l'api

Statut : acceptée (2026-10-10)

## Contexte

La création d'un projet (§11.1) compte dix étapes, longues à remplir (histoire, médias, paliers, contreparties). Un porteur doit pouvoir s'interrompre, changer d'appareil et reprendre exactement où il s'était arrêté. Les règles (longueurs, paliers cumulatifs, durée, prérequis de publication) n'existent que dans l'api (ADR 0083).

## Décision

- Une adresse par étape : `/{locale}/projects/new` (Essentiel, crée le brouillon), puis `/{locale}/projects/{slug}/edit/{étape}` ; `/{locale}/projects/{slug}/edit` renvoie à la première étape obligatoire incomplète (`resumeStep`, testé). L'aperçu a son propre segment (`edit/preview`) : la page publique, rendue par le serveur depuis `GET /v1/projects/{id}/preview`, ne charge pas son code dans les autres étapes.
- Le brouillon vit dans l'api, jamais dans le navigateur : chaque étape enregistre par `PATCH` (ou le remplacement des paliers, de la galerie, des documents) 800 ms après la dernière frappe (`useAutosave`), et aussi en quittant l'étape (boutons, liens des étapes, `pagehide`). Un indicateur `role="status"` dit « Enregistrement… », « Enregistré » ou l'échec avec sa raison.
- Chaque étape est chargée à la demande (`next/dynamic`, rendue par le serveur) : la page ne porte que le code de l'étape de son adresse.
- La publication passe par le mécanisme des prérequis (ADR 0105) et un consentement explicite à l'affichage public du porteur et de l'équipe (ADR 0040). La suppression n'existe qu'au brouillon, confirmée par la saisie du titre.
- Après la première contribution payée, l'objectif, les seuils des paliers et les montants minimums des contreparties sont affichés verrouillés, avec la raison donnée par l'api (`fundingFrozen`, `lib/locked.ts`, testé) ; les textes restent modifiables.

## Conséquences

- Reprise exacte sur tout appareil ; aucune donnée de brouillon dans le stockage du navigateur.
- Une écriture par pause de saisie : l'api limite déjà les écritures par membre.
