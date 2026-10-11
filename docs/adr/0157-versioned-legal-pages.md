# 0157. Pages juridiques versionnées, en attente de validation

Statut : acceptée (2026-10-11).

## Contexte

Les conditions générales, la politique de confidentialité, les mentions légales, la politique de cookies, le point de contact du règlement sur les services numériques et la déclaration d'accessibilité doivent exister avant la mise en production ; aucun texte juridique ne peut être inventé (`AGENTS.md`).

## Décision

- Chaque page est rendue depuis un fichier Markdown versionné (`apps/web/content/legal/<langue>/<document>.md`, français et anglais) : en-tête `title`, `status` (`pending` ou `validated`), `version` (`terms`, `privacy` ou `none`), puis titres, paragraphes et listes. Un analyseur minimal produit un arbre rendu par React : aucun HTML injecté.
- Tant que `status` vaut `pending`, un bloc visible dit « Texte en attente de validation juridique ». Les sections des textes non fournis portent seulement « Texte à fournir par le conseil juridique ».
- La version affichée des conditions et de la politique de confidentialité est celle de l'api (`GET /v1/legal-documents/current`), celle que le membre accepte à l'onboarding ; l'onboarding renvoie à ces pages (une adresse externe `NEXT_PUBLIC_LEGAL_*_URL` reste prioritaire).
- La politique de cookies, la page de signalement et la déclaration d'accessibilité décrivent factuellement ce que fait le code (ADR 0158, module trust, tests d'accessibilité), et restent marquées à valider.

## Conséquences

- Publier un texte validé : remplacer le Markdown, passer `status` à `validated` et la version de l'api (`LEGAL_TERMS_VERSION`, `LEGAL_PRIVACY_VERSION`) dans le même déploiement.
- La fourniture des textes bloque la mise en production (`docs/production-readiness.md`, question 135).
