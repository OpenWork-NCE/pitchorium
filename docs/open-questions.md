# Questions ouvertes

Informations nécessaires au développement et absentes du cahier des charges (`docs/product/cahier-des-charges.md`). Rien de ce qui suit n'est implémenté par supposition. Une question tranchée est retirée de cette liste et sa réponse documentée là où elle s'applique.

## Impact

1. Les 12 critères du score d'impact : intitulés, définitions, échelles de réponse (§2.1, §12).
2. Les pondérations des critères et le calcul du score sur 100.
3. Les seuils des paliers émergent, modéré et fort (le document cite seulement les filtres 40+ et 70+).

## Matching et découverte

4. Les règles de matching du prototype : correspondances besoins et casquettes, secteurs, complémentarité géographique et sectorielle, ordre de priorité (§2.1, §10.2, §11.4).
5. La liste des secteurs, des stades d'entreprise, des besoins et des expertises.
6. Le contenu de la « découverte éditorialisée » : qui choisit les projets et profils mis en avant (§10.3).

## Paiements

7. La devise de libellé d'une campagne (EUR uniquement, devise du porteur, ou au choix) ; l'objectif est exprimé en euros au §11.1.
8. La gestion du change : qui le porte, à quel taux, à quel moment, et son affichage au contributeur et au porteur.
9. La couverture pays et devises de Flutterwave et de Stripe Connect à retenir : pays des porteurs, pays des contributeurs, moyens de paiement par pays.
10. Le choix final du prestataire d'encaissement (option A ou B du §15) et le recours éventuel à Mangopay ou Lemonway pour le séquestre.
11. L'assiette et l'arrondi de la commission de 5 % (sur le brut ou net des frais du prestataire ; arrondi en faveur de qui).
12. Le comportement d'une campagne non financée à l'échéance (remboursement, versement partiel, paliers indépendants).
13. Le niveau de KYC exigé du porteur et le prestataire qui le réalise.
14. Le cadre légal de l'equity et des prêts (licence ECSP ou partenaire habilité) : conditions d'activation des flags `funding.equity` et `funding.loans`.

## Produit

15. La décision sur les stories (refus, ou « actualités éphémères de projet » en V2 selon le §15).
16. La vérification d'organisation (badge) : critères et processus de validation.
17. Le module « Événements » (§14, V3) : aucune description fonctionnelle.
18. Les missions d'expertise packagées : contenu, déroulé, éventuelle rémunération.
19. Les rôles d'administration et de modération, et la composition de l'équipe de modération.
20. Les durées de conservation (messages, signalements, journal d'audit, comptes supprimés) et la procédure RGPD de suppression.

## Langues

21. Les traducteurs natifs et relecteurs pour le swahili, le wolof et le lingala, et le glossaire métier (§8.2, §8.3).
22. L'outil de traduction retenu (Crowdin ou Lokalise).
23. Le relecteur professionnel de la version anglaise (statut `pending-review` dans le manifeste).

## Exploitation

24. Le choix de l'hébergeur (conteneurs api et worker, PostgreSQL et Redis managés) et la région.
25. Les domaines (site, api, bucket public R2) et l'adresse d'expédition des emails.
26. Le fournisseur de traces OpenTelemetry et le projet Sentry.
27. Les identifiants OAuth Google, LinkedIn et Microsoft (Microsoft conditionné à la demande B2B selon le §7.3).
