# 0119. Éditeur du composeur : Tiptap

Statut : acceptée (2026-10-09).

## Contexte

Le composeur d'une publication (§10.3) demande un texte de 3 000 caractères avec retours à la ligne, des liens reconnus à la frappe et au collage, et des mentions de membres et d'organisations par `@`, au clavier et à la souris, qui deviennent exactement les jetons que l'api résout (`@identifiant`, `@slug`, ADR 0031). Une zone de texte simple ne montre pas une mention comme une entité (son nom, et non son identifiant) et ne permet pas de la retirer d'un geste ; un éditeur riche complet (gras, titres, listes) n'a pas de sens : l'api ne stocke que du texte.

Candidats maintenus, sous licence permissive : Tiptap 3 (ProseMirror, extensions officielles Mention, Link, Placeholder, sans dépendance à un service), Lexical (Meta) et Slate. Tiptap est le seul à fournir mention, suggestion et liens automatiques maintenus ensemble, avec un document JSON simple à convertir.

## Décision

- Tiptap 3.31.4 (MIT), réduit au strict nécessaire : document, paragraphe, texte, retour à la ligne, annulation, texte indicatif, liens automatiques (`autolink`, `linkOnPaste`, http et https seulement, `rel="noopener noreferrer nofollow ugc"`) et mentions (extension Mention, liste de suggestions dessinée par le web, `MentionList`).
- Les suggestions viennent de la recherche de l'api (`GET /v1/discovery/autocomplete`, personnes et organisations) : les membres bloqués de part et d'autre n'y sont jamais (ADR 0029, 0066). Clavier : flèches, Entrée ou Tab, Échap ; la souris aussi.
- Le document de l'éditeur devient le texte de l'api par `serializeMentions` (`features/content/lib/mention-text.ts`) : un paragraphe par ligne, `@clé` pour une mention, une espace ajoutée seulement là où le texte toucherait la clé (la règle de l'api l'exige) ; `documentFromText` refait le document d'une publication modifiée à partir de son texte et des mentions résolues par l'api. Tests unitaires des deux sens, contre le motif même de l'api.
- L'éditeur n'est chargé qu'à l'ouverture du composeur (survol ou focus du bouton, ou pression), jamais dans le premier chargement du fil : `check:bundles` refuse ProseMirror dans le premier chargement de tout groupe. Morceau mesuré : 117,5 kB compressés (éditeur, composeur et réorganisation des images).
- Les commentaires gardent une zone de texte (`MentionTextarea`) avec les mêmes suggestions : un commentaire est court, sans lien d'aperçu ni image.

## Conséquences

- Une mention s'affiche par son nom dans l'éditeur et part comme l'api l'attend ; un homonyme (même clé pour un membre et une organisation) est résolu comme membre par l'api, comme le dit le module content.
- Une dépendance de plus, figée exactement, chargée à la demande.
