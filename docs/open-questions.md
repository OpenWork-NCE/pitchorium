# Questions ouvertes

Informations nécessaires au développement et absentes du cahier des charges (document client confidentiel, hors du dépôt). Rien de ce qui suit n'est implémenté par supposition. Une question tranchée est retirée de cette liste et sa réponse documentée là où elle s'applique. Les numéros sont stables (le code et la documentation les citent) ; l'ordre de traitement est celui de `docs/production-readiness.md`.

## Bloquant pour la mise en production

Sans réponse, la plateforme ne peut pas ouvrir au public : chaque point conditionne un compte, un texte, un paramétrage ou une activation.

### Validation juridique des paiements

- **14.** Le cadre légal de l'equity et des prêts (licence ECSP ou partenaire habilité) : conditions d'activation des flags `funding.equity` et `funding.loans`.
- **13.** Le niveau de KYC exigé du porteur et le prestataire qui le réalise. Provisoirement (ADR 0050) : vérification par Stripe sur son rail, revue manuelle par un administrateur sur les autres rails, sans liste de pièces exigées par pays.
- **51.** La qualification juridique du schéma retenu : absence de détention de fonds avec les charges directes de Stripe Connect, et avec les sous-comptes de Flutterwave, où le paiement passe par le compte marchand de Pitchorium avant le partage et où un remboursement débite le compte principal.
- **52.** La prise en charge des frais du prestataire par le porteur (ADR 0047) et son acceptation contractuelle par les porteurs.
- **53.** Le sort de la commission sur un litige perdu : Stripe ne la rend pas d'office, elle reste aujourd'hui acquise à Pitchorium.
- **54.** Les seuils de lutte contre le blanchiment : seuil de vérification renforcée (provisoirement 1 000 EUR, double authentification exigée), mesures au-delà, cumul par période, filtrage des sanctions par les prestataires.
- **55.** Les bornes et fréquences des contributions : provisoirement 1 EUR à 10 000 EUR d'équivalent, 10 contributions par heure et par contributeur, 5 sessions par heure et par moyen de paiement, sessions de 60 minutes (`PAYMENTS_*`).
- **56.** Les dons anonymes : autorisés ou non, et à quelles conditions (désactivés par défaut, `PAYMENTS_ANONYMOUS_DONATIONS`).
- **57.** Le prestataire de KYC automatisé à brancher sur le port `KycProvider`, et les pièces exigées par pays pour la revue manuelle.
- **58.** L'absence de reçu fiscal : responsabilité du porteur, mentions selon son statut (association, entreprise, personne).
- **60.** La portée de la validation d'une contribution hors plateforme par un administrateur (attestation ou contrôle de cohérence) et les pièces acceptées.

### Prestataire pour l'Afrique francophone

- **9.** La couverture pays et devises de Flutterwave et de Stripe Connect à retenir : pays des porteurs, pays des contributeurs, moyens de paiement par pays. La matrice vérifiée le 2026-10-07 (`docs/architecture/payments.md`) laisse sans rail l'Afrique francophone et le Kenya (voir les questions 61 et 62).
- **10.** Le choix final du prestataire d'encaissement (option A ou B du §15) et le recours éventuel à Mangopay ou Lemonway pour le séquestre. Provisoirement l'option A, recommandée par le document : Stripe Connect et Flutterwave (ADR 0043 à 0045).
- **61.** Stripe Connect pour des porteurs au Nigeria, au Kenya, au Ghana, en Afrique du Sud ou en Côte d'Ivoire : seulement « extended network » par Paystack, versements transfrontaliers d'une plateforme EEE limités aux US, UK, EEE, Canada et Suisse. À confirmer avec Stripe, ou à servir par Paystack. Les comptes en zone hors euro (Royaume-Uni, Suisse, EEE hors euro) et les départements d'outre-mer des Caraïbes (pays ISO distincts de FR) ne sont pas non plus retenus.
- **62.** Flutterwave : sous-comptes de collecte au Sénégal, en Côte d'Ivoire, au Burkina Faso, au Cameroun, au Kenya et en Afrique du Sud ; partage d'un paiement par carte en EUR, GBP ou USD vers un sous-compte réglé en devise africaine (contributions de la diaspora) ; opérateurs de Mobile Money en collecte au Rwanda et en Tanzanie ; montants minimum et maximum ; valeur de `payment_options` pour le Mobile Money francophone (deux tableaux contradictoires) ; filtre par défaut de `GET /v3/chargebacks` sans `status` (la référence affiche `lost` comme valeur par défaut). À confirmer avec Flutterwave.

### Établissement et TVA

- **59.** Le pays d'établissement de Pitchorium (hypothèse : Espace économique européen), qui conditionne l'analyse de Stripe Connect, et la TVA applicable à la commission.

### Critères d'impact

- **1.** Les 12 critères du score d'impact : intitulés, définitions, échelles de réponse (§2.1, §12). Le module impact les accueille comme une version de méthodologie créée et publiée par un administrateur (ADR 0036) ; aucune n'est livrée, les données de développement publient une méthodologie fictive « DEMO ».
- **2.** Les pondérations des critères et le calcul du score sur 100. Calcul provisoire : moyenne pondérée des réponses rapportées au maximum de leur échelle, arrondie au plus proche (`apps/server/src/modules/impact/domain/scoring.ts`).
- **3.** Les seuils des paliers émergent, modéré et fort (le document cite seulement les filtres 40+ et 70+). Provisoirement déduits de ces filtres : `emerging` en dessous de 40, `moderate` de 40 à 69, `strong` à partir de 70.

### Textes légaux et conformité

- **31.** Les textes des CGU et de la politique de confidentialité, leurs identifiants de version (`LEGAL_TERMS_VERSION`, `LEGAL_PRIVACY_VERSION`, actuellement `draft-2026-10` en local) et leurs adresses publiées, liées depuis l'onboarding (`NEXT_PUBLIC_LEGAL_TERMS_URL`, `NEXT_PUBLIC_LEGAL_PRIVACY_URL` ; sans elles, la version seule est affichée).
- **20.** Les durées de conservation (messages, signalements, journal d'audit, comptes supprimés) et la procédure RGPD de suppression.
- **81.** Les obligations du règlement européen sur les services numériques (DSA) réellement applicables à Pitchorium (hébergeur, plateforme en ligne, exemption des petites entreprises), le point de contact des autorités et des utilisateurs, le format du rapport de transparence. Le flux livré est conçu pour être compatible (ADR 0072), sans engagement de conformité.
- **84.** La conservation des signalements, des coordonnées des notifiants sans compte et des décisions de modération (voir aussi la question 20 et `docs/compliance/retention.md`).
- **85.** La durée de conservation des données financières pseudonymisées (contributions, ledger, comptes de versement) et des pièces KYC, qui restent des données personnelles sous un pseudonyme (obligations comptables et de lutte contre le blanchiment selon le pays d'établissement, question 59).
- **86.** Les délais des droits RGPD (provisoires) : délai de grâce de 30 jours avant une suppression, rappel 7 jours avant, un export par 24 heures, archive conservée 72 heures, lien de 5 minutes.

### Hébergeur et outils d'exploitation

- **24.** Le choix de l'hébergeur (conteneurs api et worker, PostgreSQL et Redis managés) et la région.
- **96.** L'hébergement de l'application web (`apps/web`) : Vercel (Vercel Analytics et Speed Insights, `NEXT_PUBLIC_VERCEL_ANALYTICS=true`) ou le même hébergeur que l'api (un conteneur Node.js `next start`), et son domaine (`NEXT_PUBLIC_SITE_URL`, voir la question 25).
- **26.** Le fournisseur de traces OpenTelemetry et le projet Sentry.

### Domaines

- **25.** Les domaines (site, api, bucket public R2) et l'adresse d'expédition des emails.

### Comptes de production

- **27.** Les identifiants OAuth de production Google, LinkedIn et Microsoft (application Entra ID multi-tenant), avec les URI de redirection `<API_PUBLIC_URL>/v1/auth/callback/<fournisseur>`, et le domaine parent des cookies (`AUTH_COOKIE_DOMAIN`).
- **105.** Le site Cloudflare Turnstile de production (ADR 0103), dans le compte Cloudflare du client : nom d'hôte autorisé (domaine du web), mode du widget (managé ou invisible) et apparence voulue (`TURNSTILE_APPEARANCE` : discret par défaut) ; clés `TURNSTILE_SITE_KEY` et `TURNSTILE_SECRET_KEY`.
- **90.** Les comptes de production au nom du client : Stripe (compte de plateforme Connect, mode live, webhooks), Flutterwave (compte marchand live), Resend (domaine d'envoi vérifié), Cloudflare R2 et jeton de purge du CDN, DeepL ou Google Cloud Translation, Sentry ; qui les ouvre et qui détient les accès (`docs/production-readiness.md`).

## À trancher ensuite

Valeurs provisoires livrées et documentées : la plateforme fonctionne avec elles, à confirmer ou ajuster.

### Matching et découverte

- **4.** Les règles de matching du prototype : correspondances besoins et casquettes, secteurs, complémentarité géographique et sectorielle, ordre de priorité (§2.1, §10.2, §11.4). Des règles provisoires sont livrées (ADR 0067, `apps/server/src/modules/discovery/domain/matching.ts`) : besoin et casquette (35 points), mission qui répond à un besoin ou cherche une casquette (35), entrepreneurs complémentaires (30), secteur commun, pays d'intervention, événement dans un pays du membre (20), mentorat (15), ticket et financement visé (15), instruments, mission accessible, langue commune (10), seuil de 20 points ; toutes à valider.
- **5.** Les plafonds du matching et de la recherche (provisoires) : 500 candidats par liste, 50 suggestions gardées, 2 000 sujets mis à jour quand un candidat change, 1 000 résultats paginés, 10 suggestions au plus en fin de fil, similarité de mot 0,5 pour la tolérance aux fautes (ADR 0066 et 0068).
- **6.** Le choix des sections de la page Découvrir et de la sélection éditoriale : aujourd'hui les projets mis en avant par la modération (voir aussi la question 6).
- **91.** La liste des secteurs, des stades d'entreprise, des besoins et des expertises. Provisoirement : secteurs = 21 sections CITI/ISIC rév. 4 (libellés français à faire relire), stades = `idea`, `prototype`, `early_revenue`, `growth`, `scale`, besoins alignés sur les casquettes (`NEED_TO_HATS`), expertises recherchées en texte libre (ADR 0018).
- **92.** Le contenu de la « découverte éditorialisée » : qui choisit les projets et profils mis en avant (§10.3).

### Profils

- **28.** Les pondérations de la force du profil et les seuils des niveaux Débutant, Intermédiaire, Avancé, Complet (§7.2) : règle provisoire dans `apps/server/src/modules/profiles/domain/profile-strength.ts`.
- **29.** Le contenu minimal du volet entrepreneur exigé avant de publier un projet (provisoirement : entreprise, secteur, stade, pays de l'entreprise) et du volet contributeur (au moins une casquette et le type de structure).
- **30.** La longueur maximale du pitch (provisoirement 2 600 caractères, comme la présentation) et la liste des identifiants publics réservés.
- **111.** Le profil minimum exigé avant une demande de connexion ou un premier message hors réseau : provisoirement nom, titre et pays de résidence, sans la photo (élément `profile.minimum`, ADR 0109).

### Fichiers

- **33.** Les limites par usage (types acceptés, taille maximale, dimensions minimales et maximales, nombre de pages, nombre par ressource, visibilité par défaut) : valeurs provisoires dans `apps/server/src/modules/media/domain/usages.ts` et dans le README du module media.
- **34.** Les quotas par membre (provisoirement 500 fichiers, 1 Gio et 60 demandes de téléversement par heure) et le délai de suppression des fichiers non attachés (provisoirement 24 heures).

### Réseau

- **39.** Les seuils anti-abus des demandes de connexion : plafond hebdomadaire (provisoirement 100 demandes sur sept jours glissants, `NETWORK_CONNECTION_REQUESTS_PER_WEEK`), délai avant une nouvelle demande après un refus (provisoirement 21 jours, `NETWORK_DECLINE_COOLDOWN_DAYS`) et expiration des demandes en attente (provisoirement 30 jours, `NETWORK_REQUEST_TTL_DAYS`).
- **40.** La durée de conservation des vues de profil (provisoirement 90 jours, `NETWORK_PROFILE_VIEWS_RETENTION_DAYS`) et le contenu de la mention anonymisée d'une visite privée (provisoirement le premier secteur que le visiteur montre aux membres).
- **41.** Le plafond de calcul des connexions en commun (provisoirement 999, affiché « 999+ », `NETWORK_MUTUAL_CONNECTIONS_CAP`) et l'arrêt du degré de relation au 2e degré.

### Contenu

- **42.** Le seuil du complément éditorial du fil (provisoirement 10 publications du réseau, `CONTENT_FEED_EDITORIAL_THRESHOLD`) et la composition de l'équipe éditoriale qui met en avant (aujourd'hui les rôles `moderator` et `admin` avec double authentification ; voir aussi la question 6).
- **43.** La longueur maximale d'un commentaire (provisoirement 1 250 caractères) et le nombre maximal de mentions par publication (provisoirement 20).

### Projets

- **44.** L'interprétation des « paliers indépendants » (§2.1) : provisoirement des seuils cumulatifs strictement croissants dont le dernier est l'objectif, chaque palier débloqué dès que le collecté atteint son seuil (ADR 0038).
- **45.** Le financement flexible : provisoirement, à l'échéance, les paliers atteints restent acquis et rien n'est remboursé automatiquement, que l'objectif soit atteint ou non (voir aussi la question 12) ; un retour de `funded` à `funding` a lieu si une annulation repasse sous l'objectif avant l'échéance.
- **46.** La prolongation d'une campagne : aucune aujourd'hui, la date de fin est fixée à la publication.
- **47.** Le dépassement de l'objectif : accepté sans plafond, le projet reste ouvert jusqu'à sa date de fin.
- **48.** Le délai de l'événement « fin de campagne proche » (provisoirement 72 heures, `PROJECTS_ENDING_SOON_HOURS`).
- **49.** Les limites des champs d'un projet (titre 120, résumé 300, description 20 000, zone d'impact 200, 10 pays, galerie de 20 images, 10 documents, actualité de 5 000 caractères avec 6 images, message d'intérêt de 2 000 caractères avec 3 PDF) et le sous-ensemble Markdown de la description (`apps/server/src/modules/projects/README.md`).
- **50.** La durée de validité d'une réservation de contrepartie non confirmée, à fixer avec le module payments selon le délai de paiement des prestataires.

### Organisations

- **36.** Les critères de vérification d'une organisation (pièces exigées par type de structure et par pays, contrôles du modérateur) et le processus de validation : le flux est en place avec une liste de critères configurable (`ORGANIZATIONS_VERIFICATION_CRITERIA`), vide par défaut (§13, §14).
- **37.** Le nombre maximal d'organisations créées par membre (provisoirement 5) et la durée de validité d'une invitation (provisoirement 7 jours).
- **38.** La composition de l'équipe qui relit les demandes de vérification (rôle `moderator` ou `admin` aujourd'hui).

### Paiements

- **7.** La devise de libellé d'une campagne (EUR uniquement, devise du porteur, ou au choix) ; l'objectif est exprimé en euros au §11.1. Provisoirement l'euro, la devise étant stockée avec chaque montant (ADR 0037).
- **8.** La gestion du change : qui le porte, à quel taux, à quel moment, et son affichage au contributeur et au porteur. Provisoirement (ADR 0046) : parité fixe exacte pour XOF et XAF, taux indicatif de Flutterwave figé pour la session pour les autres devises, écart avec le change réel supporté hors de la plateforme.
- **11.** L'assiette et l'arrondi de la commission de 5 % (sur le brut ou net des frais du prestataire ; arrondi en faveur de qui). Provisoirement (ADR 0047) : assiette le montant de la contribution, arrondi à l'unité mineure inférieure en faveur du porteur, commission rendue au prorata (arrondi supérieur) en cas de remboursement.
- **12.** Le comportement d'une campagne non financée à l'échéance (remboursement, versement partiel, paliers indépendants).
- **63.** Les grilles de frais des prestataires hors France (Stripe) et hors Nigeria (Flutterwave), pour l'estimation du devis.
- **64.** La migration éventuelle vers l'API v4 de Flutterwave (authentification OAuth, signature HMAC des webhooks).
- **65.** Le journal du temps partagé : durée maximale d'une déclaration (provisoirement 24 heures), délai pour déclarer, sort d'une déclaration sans réponse du bénéficiaire, et prise en compte des heures dans le tableau de bord d'une organisation (aujourd'hui aucune : les heures sont personnelles).
- **66.** Le tableau de bord d'impact ne compte que les contributions encaissées (§9.4) : les contributions hors plateforme validées doivent-elles y figurer ?

### Messagerie

- **67.** La préférence de messagerie par défaut d'un membre (provisoirement `connections_and_second_degree`, `MESSAGING_DEFAULT_POLICY`) et la portée de `verified_members` : aujourd'hui tout membre à l'email vérifié, seule vérification d'une personne (aucun KYC pour les contributeurs).
- **68.** La fenêtre de modification d'un message (provisoirement 15 minutes, `MESSAGING_EDIT_WINDOW_MINUTES`), le plafond de premières demandes hors réseau (provisoirement 20 sur 24 heures, `MESSAGING_REQUESTS_PER_DAY`), la longueur de la note d'introduction (provisoirement 1 000 caractères) et le nombre de pièces jointes par message (provisoirement 5).
- **69.** La durée de conservation des messages et des pièces jointes (voir aussi la question 20) ; un refus de demande est définitif tant que les membres ne se connectent pas.

### Notifications

- **70.** Les canaux par défaut de chaque type (`apps/server/src/modules/notifications/domain/notification-types.ts`), dont l'email des messages non lus désactivé par défaut (§10.4 « si le destinataire l'a accepté ») et la liste des types transactionnels (contributions reçues, remboursements, KYC, contributions hors plateforme, sécurité).
- **71.** La fenêtre de regroupement (provisoirement 24 heures, `NOTIFICATIONS_AGGREGATION_WINDOW_MINUTES`), la taille des lots de création et de livraison (500, `NOTIFICATIONS_FANOUT_BATCH_SIZE`, ADR 0064) et le plafond des notifications de faible priorité (20 par membre et par jour, `NOTIFICATIONS_LOW_PRIORITY_PER_DAY`).
- **72.** Le délai avant la copie d'un message non lu (provisoirement 30 minutes), l'heure locale des digests (provisoirement 8 h) et le jour du digest hebdomadaire (provisoirement le lundi), le digest par défaut (provisoirement aucun : un email par notification).
- **73.** La rétention des notifications (provisoirement 90 jours, `NOTIFICATIONS_RETENTION_DAYS`), la levée d'une adresse supprimée après un rebond (une adresse corrigée ne reçoit plus rien, emails transactionnels compris) et la période des vues de profil notifiées (provisoirement la veille, en UTC).

### Événements

- **74.** Le périmètre proposé (ADR 0069) : organisateurs (membre, organisation, projet), contenu, visibilité, liste d'attente, rappels, export iCalendar, absence de suivi d'un événement. À valider.
- **75.** Les limites d'un événement (provisoirement titre 120 caractères, description 10 000, 5 secteurs, 10 pays, durée de 14 jours au plus, capacité de 100 000) et la conservation des événements passés dans le calendrier personnel (provisoirement 30 jours).
- **76.** Le délai des rappels avant un événement (provisoirement 24 heures, `NOTIFICATIONS_EVENT_REMINDER_HOURS`) et la fermeture des inscriptions (provisoirement au début de l'événement).
- **77.** La billetterie payante : hors périmètre (ADR 0070), les événements sont gratuits.

### Missions

- **78.** Le périmètre proposé (ADR 0071) : offres des mentors et experts, demandes des entrepreneurs et équipes de projet, candidature ou sollicitation, réponse, achèvement avec heures confirmées, sans rémunération ni avis. À valider.
- **79.** Les bornes d'une mission (provisoirement session de 8 heures et mission courte de 80 heures au plus, capacité de 20 missions en cours, titre 120 caractères, description 5 000, message 2 000), la liste des domaines d'expertise (texte libre aujourd'hui) et la liste des termes refusés comme vocabulaire d'offre d'emploi (`apps/server/src/modules/missions/domain/mission.ts`).
- **80.** L'absence d'avis et de notation des missions (non prévus par le cahier des charges).

### Produit

- **15.** La décision sur les stories (refus, ou « actualités éphémères de projet » en V2 selon le §15).
- **16.** La vérification d'organisation (badge) : critères et processus de validation.
- **17.** Le module « Événements » (§14, V3) : aucune description fonctionnelle. Un périmètre provisoire est livré (ADR 0069, section « Événements » ci-dessous) et doit être validé.
- **18.** Les missions d'expertise packagées : contenu, déroulé, éventuelle rémunération. Un périmètre provisoire bénévole est livré (ADR 0071, section « Missions » ci-dessous).
- **19.** La composition de l'équipe de modération et la répartition des permissions. Provisoirement (ADR 0073, module trust) : le `moderator` traite la file, masque et retire les contenus, avertit, suspend jusqu'à `TRUST_MODERATOR_MAX_SUSPENSION_DAYS` (30 jours) et tranche les appels ; la suspension définitive ou plus longue, le gel d'un projet, les remboursements d'un projet gelé et les compteurs de transparence sont réservés à l'`admin`.

### Confiance et sécurité

- **82.** Les valeurs provisoires de la modération : liste des motifs de signalement (`REPORT_REASONS`), poids de la priorité (`apps/server/src/modules/trust/domain/priority.ts`), seuils des signaux automatiques (15 premiers messages hors réseau ou 50 demandes de connexion en 24 heures, 3 signalements reçus en 7 jours), 5 signalements sans compte par heure et par adresse, délai d'appel de 183 jours, 3 messages de contexte pour un message signalé.
- **83.** La contestation d'un classement sans suite par le notifiant (prévue par le DSA pour les plateformes en ligne) : aujourd'hui seul le membre concerné par une décision peut faire appel.

### Comptes et conditions

- **32.** Le préremplissage LinkedIn : le §7.3 prévoit titre, photo et organisation, mais « Sign In with LinkedIn using OpenID Connect » ne fournit que le nom, la photo et l'email. Le titre et l'organisation demanderaient un produit LinkedIn partenaire (accès au profil complet) : à confirmer ou à retirer du périmètre.

### Langues

- **21.** Les traducteurs natifs et relecteurs pour le swahili, le wolof et le lingala, et le glossaire métier (§8.2, §8.3).
- **22.** L'outil de traduction retenu (Crowdin ou Lokalise).
- **23.** Le relecteur professionnel de la version anglaise (statut `pending-review` dans le manifeste).
- **87.** La couverture du wolof : Google Cloud Translation ne le propose pas (documentation du 2026-10-07), contrairement au tableau du §8.2 ; DeepL le propose sans glossaire.
- **88.** Les limites de la traduction à la demande (provisoires) : 20 000 caractères par membre et par jour, 500 000 caractères par mois pour la plateforme (palier gratuit de DeepL), cache de 30 jours ; le choix du prestataire principal et de son offre (DeepL API Free ou Pro, Google Cloud Translation Basic ou Advanced) ; l'anglais britannique comme variante cible de DeepL.
- **89.** Les traductions anglaises du glossaire métier (palier, mécène, love money, contrepartie, porteur de projet, equity...), provisoires jusqu'à la relecture professionnelle (voir aussi les questions 21 et 23).

### Frontend

- **110.** Les libellés courts des secteurs (`reference.sectorsShort`), provisoires, utilisés dans les puces, les cartes et les phrases de suggestion ; le libellé complet reste en infobulle et sur les pages de détail. À valider (et à traduire) : `agriculture_forestry_fishing` « Agriculture », `mining_quarrying` « Extraction », `manufacturing` « Industrie », `energy` « Énergie », `water_waste` « Eau et déchets », `construction` « Construction », `trade` « Commerce », `transport_storage` « Transport », `accommodation_food` « Hôtellerie », `information_communication` « Numérique », `finance_insurance` « Finance », `real_estate` « Immobilier », `professional_scientific_technical` « Conseil », `administrative_support` « Services aux entreprises », `public_administration` « Administration », `education` « Éducation », `health_social_work` « Santé », `arts_entertainment_recreation` « Culture », `other_services` « Autres services », `households` « Ménages », `extraterritorial_organizations` « Organisations internationales ».
- **109.** Le délai de renvoi d'un email de connexion ou de vérification (60 s affichées, provisoire).
- **93.** Les budgets de performance proposés (ADR 0090 et 0094, `docs/architecture/frontend.md`) : JavaScript initial compressé par groupe de routes, framework compris (`(marketing)` 190 kB, `(public)` et `(auth)` 220 kB, `(app)` 250 kB, `(admin)` 260 kB), Lighthouse mobile (performance 90, accessibilité, bonnes pratiques et SEO 100, LCP 2,5 s, CLS 0,1, TBT 300 ms) et INP sous 200 ms.
- **94.** La « matière » du mouvement (`docs/design/motion.md`) : le motif d'élévation des fonds de marque, ton sur ton, comme sur un papier mat, sans grain ni WebGL ; le dialecte éditorial D4 des pages publiques.
- **95.** La variante d'interface du logo horizontal sur fond sombre : le kit ne la fournit qu'avec son rectangle `#121212` ; la version transparente utilisée par le web est déduite (même dessin, fond retiré, `docs/design/brand-usage.md`). De même, l'icône d'application sombre (fond violet) retenue pour le manifeste et l'icône d'écran d'accueil.
- **97.** La licence de GSAP (« Standard No Charge License » de Webflow, gratuite, non open source) pour les pages éditoriales, et celle de l'outil `sentry` (FSL-1.1, envoi des cartes de sources au build).
- **99.** Les éléments de design dérivés du guide, à valider par la marque : échelles de couleurs et couleurs de statut (`docs/design/tokens.md`), poids 500 et 600 de Poppins et repli Noto Sans pour les caractères absents (`docs/design/typography.md`).
- **100.** Le texte de l'accueil provisoire et la description du site (`web.home`, `web.metadata.description` de `packages/i18n`), repris du contexte du guide de marque ; ni slogan ni promesse.
- **101.** La direction artistique de l'application (`docs/design/direction.md`, ADR 0095), à valider par la marque : un seul accent violet et le cuivre en touches, grille de 12 colonnes et trois colonnes de l'espace membre, densité confortable, icônes lucide au trait de 1,75 et tailles de 16, 20 et 24 px, ratios des images (couverture 4:1 recadrée en 3:1 sur téléphone), avatars à initiales sur une couleur dérivée du nom, interdits.
- **104.** Les profils et organisations publics dans le sitemap (ADR 0101) : l'api n'en publie pas de liste (seuls les projets de la vitrine et les événements publics en ont une) ; faut-il une liste publique paginée (profils ayant ouvert leur page publique, organisations), ou s'en remettre aux liens internes pour leur découverte ?
