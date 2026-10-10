# 0128. Données structurées de la page projet : `Article`

Statut : acceptée (2026-10-10)

## Contexte

La page publique d'un projet (`/{locale}/projects/{slug}`, §11.2) est indexable et doit porter du JSON-LD valide au test des résultats enrichis de Google. Les types candidats de schema.org : `Product` ou `Offer` (un prix et une offre : faux, aucune contribution n'est un achat et aucun investissement ne se fait en ligne, §15 décision 5), `DonateAction` ou `MonetaryGrant` (non lus par Google, sans résultat enrichi), `Project` (en attente dans schema.org, ignoré par Google), `Article` (page éditoriale, lu par Google : titre, images, auteur, dates, éditeur).

## Décision

- Type `Article`, construit par `features/projects/lib/json-ld.ts` (testé) avec ce que la page montre à tous : titre (110 caractères au plus, limite de Google), résumé, images de la galerie (sinon l'icône de la marque : l'image de partage a une adresse à empreinte), porteur en `author` (`Person` ; l'organisation porteuse quand le porteur n'est pas public), `datePublished`, `dateModified` (dernière actualité), `contentLocation` (pays déclarés), Pitchorium en `publisher`.
- Jamais de montant, d'objectif ni de prix dans les données structurées.
- Vue visiteur seulement : un brouillon et l'aperçu sont `noindex` et sans JSON-LD.

## Conséquences

- La page peut obtenir l'aperçu d'article de Google sans promettre une offre qu'elle n'a pas.
- Si schema.org stabilise `Project` et que Google le lit, il s'ajoutera sans retirer `Article`.
