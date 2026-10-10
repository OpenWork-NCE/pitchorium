# 0130. Équivalent indicatif en francs CFA

Statut : acceptée (2026-10-10)

## Contexte

Les projets sont libellés en euros (ADR 0037), mais une grande partie des contributeurs vit en zone franc : huit pays de l'Union économique et monétaire ouest-africaine (UEMOA, franc CFA de l'Afrique de l'Ouest, XOF) et six de la Communauté économique et monétaire de l'Afrique centrale (CEMAC, franc CFA de l'Afrique centrale, XAF). Ces deux francs ont une parité fixe légale avec l'euro (655,957 francs pour un euro, ADR 0046), déjà employée par le module payments pour l'équivalent EUR d'une contribution. Les autres devises du corridor (naira, cedi, shilling) flottent : un taux affiché sur une page serait faux le lendemain.

## Décision

- La règle reste dans l'api : `FIXED_PARITY_COUNTRIES` (domaine du module payments, à côté de `FIXED_PARITIES`) associe chaque pays de l'UEMOA et de la CEMAC à son franc ; `GET /v1/me/indicative-currency` (`payment.quote`) donne le pays déclaré du membre et, s'il appartient à l'une des deux zones, le franc et sa parité (`unitsPerEur`, chaîne décimale), sinon `null`.
- La page projet d'un membre lit cette réponse sur le serveur et affiche, sous le collecté et l'objectif, l'équivalent en francs, libellé « équivalent indicatif ». Le calcul est exact, en entiers (centimes d'euro multipliés par la parité, arrondis au franc le plus proche, demi vers le haut), sans flottant (`features/projects/lib/indicative-equivalent.ts`, testé).
- Aucun équivalent pour un visiteur (pas de pays déclaré), pour un membre sans pays ou d'un pays à devise flottante : jamais de taux de marché sur une page.
- Le montant de référence reste l'euro : l'équivalent ne sert ni au paiement ni aux paliers ; le paiement en francs a son propre devis (ADR 0046).

## Conséquences

- Le franc comorien (KMF, autre parité) et toute autre devise à parité fixe s'ajoutent dans le domaine du module payments, sans changement du web.
- Un changement de pays dans le profil change l'équivalent à la lecture suivante de la page.
