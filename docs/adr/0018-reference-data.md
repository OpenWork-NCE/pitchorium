# 0018. Données de référence

Statut : acceptée (2026-10-07)

## Contexte

Les profils, puis les projets et la découverte, utilisent des pays, des secteurs et des stades. Le cahier des charges limite les entreprises à l'Afrique et aux Caraïbes mais ne fournit pas de liste de secteurs ni de stades.

## Décision

- Pays : ISO 3166-1 alpha-2 avec région, sous-région et région intermédiaire UN M49 (jeu de l'UNSD compilé par `lukes/ISO-3166-Countries-with-Regional-Codes`). Pays d'entreprise admis : région Afrique (002) ou région intermédiaire Caraïbes (029).
- Secteurs : les 21 sections de la CITI/ISIC rév. 4 (standard ONU), marquées provisoires en attendant la liste du prototype.
- Stades : `idea`, `prototype`, `early_revenue`, `growth`, `scale`, à valider.
- Tables du schéma `profiles` alimentées par `pnpm db:seed` (upsert, jamais de suppression), exposées par `GET /v1/reference-data` (public, cache mémoire de 10 minutes et HTTP d'une heure).
- Libellés : clés du namespace i18n `reference` ; noms de pays FR et EN issus de CLDR (`Intl.DisplayNames`).

## Conséquences

- Remplacer la taxonomie des secteurs demandera une migration des codes déjà enregistrés.
- Taïwan et l'Antarctique n'ont pas de région M49 : ils restent sélectionnables comme pays de résidence, pas comme pays d'entreprise.
