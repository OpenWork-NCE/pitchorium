# Questions ouvertes

Informations nécessaires au développement et absentes du cahier des charges (document client confidentiel, hors du dépôt). Rien de ce qui suit n'est implémenté par supposition. Une question tranchée est retirée de cette liste et sa réponse documentée là où elle s'applique.

## Impact

1. Les 12 critères du score d'impact : intitulés, définitions, échelles de réponse (§2.1, §12).
2. Les pondérations des critères et le calcul du score sur 100.
3. Les seuils des paliers émergent, modéré et fort (le document cite seulement les filtres 40+ et 70+).

## Matching et découverte

4. Les règles de matching du prototype : correspondances besoins et casquettes, secteurs, complémentarité géographique et sectorielle, ordre de priorité (§2.1, §10.2, §11.4).
5. La liste des secteurs, des stades d'entreprise, des besoins et des expertises. Provisoirement : secteurs = 21 sections CITI/ISIC rév. 4 (libellés français à faire relire), stades = `idea`, `prototype`, `early_revenue`, `growth`, `scale`, besoins alignés sur les casquettes (`NEED_TO_HATS`), expertises recherchées en texte libre (ADR 0018).
6. Le contenu de la « découverte éditorialisée » : qui choisit les projets et profils mis en avant (§10.3).

## Profils

28. Les pondérations de la force du profil et les seuils des niveaux Débutant, Intermédiaire, Avancé, Complet (§7.2) : règle provisoire dans `apps/server/src/modules/profiles/domain/profile-strength.ts`.
29. Le contenu minimal du volet entrepreneur exigé avant de publier un projet (provisoirement : entreprise, secteur, stade, pays de l'entreprise) et du volet contributeur (au moins une casquette et le type de structure).
30. La longueur maximale du pitch (provisoirement 2 600 caractères, comme la présentation) et la liste des identifiants publics réservés.

## Fichiers

33. Les limites par usage (types acceptés, taille maximale, dimensions minimales et maximales, nombre de pages, nombre par ressource, visibilité par défaut) : valeurs provisoires dans `apps/server/src/modules/media/domain/usages.ts` et dans le README du module media.
34. Les quotas par membre (provisoirement 500 fichiers, 1 Gio et 60 demandes de téléversement par heure) et le délai de suppression des fichiers non attachés (provisoirement 24 heures).

## Réseau

39. Les seuils anti-abus des demandes de connexion : plafond hebdomadaire (provisoirement 100 demandes sur sept jours glissants, `NETWORK_CONNECTION_REQUESTS_PER_WEEK`), délai avant une nouvelle demande après un refus (provisoirement 21 jours, `NETWORK_DECLINE_COOLDOWN_DAYS`) et expiration des demandes en attente (provisoirement 30 jours, `NETWORK_REQUEST_TTL_DAYS`).
40. La durée de conservation des vues de profil (provisoirement 90 jours, `NETWORK_PROFILE_VIEWS_RETENTION_DAYS`) et le contenu de la mention anonymisée d'une visite privée (provisoirement le premier secteur que le visiteur montre aux membres).
41. Le plafond de calcul des connexions en commun (provisoirement 999, affiché « 999+ », `NETWORK_MUTUAL_CONNECTIONS_CAP`) et l'arrêt du degré de relation au 2e degré.

## Organisations

36. Les critères de vérification d'une organisation (pièces exigées par type de structure et par pays, contrôles du modérateur) et le processus de validation : le flux est en place avec une liste de critères configurable (`ORGANIZATIONS_VERIFICATION_CRITERIA`), vide par défaut (§13, §14).
37. Le nombre maximal d'organisations créées par membre (provisoirement 5) et la durée de validité d'une invitation (provisoirement 7 jours).
38. La composition de l'équipe qui relit les demandes de vérification (rôle `moderator` ou `admin` aujourd'hui).

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
19. Les permissions du rôle `moderator` et la composition de l'équipe de modération (les rôles `member`, `moderator` et `admin` existent ; aucune action n'est encore réservée aux modérateurs).
20. Les durées de conservation (messages, signalements, journal d'audit, comptes supprimés) et la procédure RGPD de suppression.

## Comptes et conditions

31. Les textes des CGU et de la politique de confidentialité, et leurs identifiants de version (`LEGAL_TERMS_VERSION`, `LEGAL_PRIVACY_VERSION`, actuellement `draft-2026-10` en local).
32. Le préremplissage LinkedIn : le §7.3 prévoit titre, photo et organisation, mais « Sign In with LinkedIn using OpenID Connect » ne fournit que le nom, la photo et l'email. Le titre et l'organisation demanderaient un produit LinkedIn partenaire (accès au profil complet) : à confirmer ou à retirer du périmètre.

## Langues

21. Les traducteurs natifs et relecteurs pour le swahili, le wolof et le lingala, et le glossaire métier (§8.2, §8.3).
22. L'outil de traduction retenu (Crowdin ou Lokalise).
23. Le relecteur professionnel de la version anglaise (statut `pending-review` dans le manifeste).

## Exploitation

24. Le choix de l'hébergeur (conteneurs api et worker, PostgreSQL et Redis managés) et la région.
25. Les domaines (site, api, bucket public R2) et l'adresse d'expédition des emails.
26. Le fournisseur de traces OpenTelemetry et le projet Sentry.
27. Les identifiants OAuth de production Google, LinkedIn et Microsoft (application Entra ID multi-tenant), avec les URI de redirection `<API_PUBLIC_URL>/v1/auth/callback/<fournisseur>`, et le domaine parent des cookies (`AUTH_COOKIE_DOMAIN`).
