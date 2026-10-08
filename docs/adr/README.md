# Décisions d'architecture

Un fichier par décision, numéroté, au format Contexte / Décision / Conséquences. Une décision remplacée n'est pas supprimée : son statut indique l'ADR qui la remplace.

| ADR                                                      | Décision                                                     |
| -------------------------------------------------------- | ------------------------------------------------------------ |
| [0001](0001-modular-monolith-two-processes.md)           | Monolithe modulaire à deux processus                         |
| [0002](0002-one-postgres-schema-per-module.md)           | Un schéma PostgreSQL par module                              |
| [0003](0003-zod-as-contract-source.md)                   | Zod comme source unique des contrats                         |
| [0004](0004-drizzle-orm.md)                              | Drizzle ORM                                                  |
| [0005](0005-postgres-search-behind-port.md)              | Recherche PostgreSQL derrière un port                        |
| [0006](0006-outbox-and-inbox.md)                         | Outbox et inbox                                              |
| [0007](0007-money-minor-units-and-ledger.md)             | Argent en unités mineures et ledger                          |
| [0008](0008-vitest-and-testcontainers.md)                | Vitest et Testcontainers                                     |
| [0009](0009-express-http-adapter.md)                     | Adaptateur HTTP Express                                      |
| [0010](0010-eslint-boundaries.md)                        | Frontières vérifiées par ESLint                              |
| [0011](0011-minio-community-images.md)                   | Images MinIO communautaires en local                         |
| [0012](0012-runtime-and-version-choices.md)              | Runtime et choix de versions                                 |
| [0013](0013-better-auth-mounting.md)                     | Montage de Better Auth                                       |
| [0014](0014-account-linking-policy.md)                   | Politique de liaison de comptes                              |
| [0015](0015-authorization-model.md)                      | Modèle d'autorisation                                        |
| [0016](0016-faceted-profile-model.md)                    | Modèle de profil à volets                                    |
| [0017](0017-privacy-by-default.md)                       | Confidentialité par défaut                                   |
| [0018](0018-reference-data.md)                           | Données de référence                                         |
| [0019](0019-short-transactions-around-external-calls.md) | Transactions courtes autour des appels externes              |
| [0020](0020-auth-error-format.md)                        | Format d'erreur des routes d'authentification                |
| [0021](0021-origin-check-and-non-browser-clients.md)     | En-tête Origin et clients non navigateur                     |
| [0022](0022-direct-upload-quarantine-and-processing.md)  | Téléversement direct, quarantaine et traitement des fichiers |
| [0023](0023-antivirus.md)                                | Antivirus ClamAV                                             |
| [0024](0024-no-video-hosting.md)                         | Pas d'hébergement vidéo                                      |
| [0025](0025-organization-members-and-verification.md)    | Membres et vérification des organisations                    |
| [0026](0026-file-visibility.md)                          | Visibilité des fichiers                                      |
| [0027](0027-generic-follow-model.md)                     | Modèle de suivi générique                                    |
| [0028](0028-connection-and-mutual-follow.md)             | Connexion et suivi mutuel                                    |
| [0029](0029-blocking.md)                                 | Blocage                                                      |
| [0030](0030-profile-views-mechanism.md)                  | Mécanisme des vues de profil                                 |
| [0031](0031-post-visibility.md)                          | Visibilité des publications                                  |
| [0032](0032-feed-strategy.md)                            | Stratégie du fil                                             |
| [0033](0033-link-previews-and-ssrf.md)                   | Aperçus de liens et protection anti-SSRF                     |
| [0034](0034-post-statistics-hyperloglog.md)              | Statistiques de visibilité par HyperLogLog                   |
| [0035](0035-development-data-through-services.md)        | Données de développement par les services                    |
| [0036](0036-versioned-impact-methodology.md)             | Méthodologie d'impact versionnée                             |
| [0037](0037-campaign-label-currency.md)                  | Devise de libellé des campagnes                              |
| [0038](0038-tiers-and-flexible-funding.md)               | Paliers cumulatifs et financement flexible                   |
| [0039](0039-amounts-locked-after-contribution.md)        | Verrouillage des montants après la première contribution     |
| [0040](0040-public-display-consent.md)                   | Consentement d'affichage public du porteur et de l'équipe    |
| [0041](0041-reward-reservations.md)                      | Réservation des contreparties                                |
| [0042](0042-embedded-video.md)                           | Vidéo intégrée des projets                                   |
| [0043](0043-no-funds-held-routing-by-holder.md)          | Non-détention des fonds et routage par le porteur            |
| [0044](0044-stripe-connect-model.md)                     | Modèle Stripe Connect retenu                                 |
| [0045](0045-flutterwave-subaccounts.md)                  | Sous-comptes Flutterwave                                     |
| [0046](0046-currencies-and-conversion.md)                | Devises et conversion                                        |
| [0047](0047-commission-rounding-and-fees.md)             | Commission, arrondi et frais                                 |
| [0048](0048-double-entry-ledger.md)                      | Ledger en partie double et rapprochement                     |
| [0049](0049-off-platform-contributions.md)               | Contributions hors plateforme                                |
| [0050](0050-holder-kyc.md)                               | KYC du porteur                                               |
| [0051](0051-equity-and-loans-guardrail.md)               | Garde-fou equity et prêts                                    |
| [0052](0052-simulated-provider.md)                       | Prestataire simulé                                           |
| [0053](0053-engagement-projection.md)                    | Projection du module engagement                              |
| [0054](0054-provider-sandbox-tests.md)                   | Tests contre les sandboxes des prestataires                  |
| [0055](0055-conversations-and-requests.md)               | Modèle des conversations et des demandes de message          |
| [0056](0056-realtime-reliability.md)                     | Fiabilité du temps réel                                      |
| [0057](0057-no-end-to-end-encryption.md)                 | Pas de chiffrement de bout en bout des messages              |
| [0058](0058-introductions.md)                            | Introductions à trois                                        |
| [0059](0059-notification-registry-and-grouping.md)       | Registre et regroupement des notifications                   |
| [0060](0060-preferences-and-transactional-types.md)      | Préférences et types transactionnels                         |
| [0061](0061-digests-and-time-zones.md)                   | Digests et fuseaux horaires                                  |
| [0062](0062-email-deliverability.md)                     | Délivrabilité des emails                                     |
| [0063](0063-verify-clean.md)                             | Vérification depuis zéro (`pnpm verify:clean`)               |
| [0064](0064-batched-notification-delivery.md)            | Livraison des notifications par lots                         |
| [0065](0065-search-projection-by-events.md)              | Projection de recherche par événements                       |
| [0066](0066-search-multilingual-and-weighting.md)        | Multilinguisme et pondération de la recherche                |
| [0067](0067-explainable-rule-based-matching.md)          | Matching à règles explicables                                |
| [0068](0068-precomputed-suggestions.md)                  | Précalcul des suggestions                                    |
| [0069](0069-events-scope.md)                             | Périmètre des événements (à valider)                         |
| [0070](0070-free-events-only.md)                         | Événements gratuits uniquement                               |
| [0071](0071-volunteer-missions-no-job-board.md)          | Missions bénévoles, pas de job board                         |
| [0072](0072-moderation-compatible-with-the-dsa.md)       | Modération compatible avec le DSA                            |
| [0073](0073-suspension.md)                               | Suspension d'un compte                                       |
| [0074](0074-export-and-erasure.md)                       | Export et suppression des données personnelles               |
| [0075](0075-financial-pseudonymization.md)               | Pseudonymisation des données conservées                      |
| [0076](0076-translation-on-demand.md)                    | Traduction à la demande des contenus                         |
| [0077](0077-locale-activation-guardrails.md)             | Garde-fous de l'activation des langues                       |
| [0078](0078-administration.md)                           | Administration                                               |
| [0079](0079-strict-inputs.md)                            | Entrées strictes                                             |
| [0080](0080-delivery.md)                                 | Livraison : image, analyses et versions                      |
| [0081](0081-web-app-next-16.md)                          | Application web Next.js 16                                   |
| [0082](0082-design-system-radix.md)                      | Design system possédé sur Radix UI                           |
| [0083](0083-web-data-flow.md)                            | Flux de données du web                                       |
| [0084](0084-web-internationalisation.md)                 | Internationalisation du web                                  |
| [0085](0085-design-tokens-and-theme.md)                  | Tokens de design et thème                                    |
| [0086](0086-motion.md)                                   | Mouvement                                                    |
| [0087](0087-brand-assets-and-fonts.md)                   | Fichiers de marque et polices                                |
| [0088](0088-web-security-headers-and-csp.md)             | Sécurité du web : CSP à nonce et en-têtes                    |
| [0089](0089-web-boundaries-and-lint.md)                  | Frontières et règles du web                                  |
| [0090](0090-web-tests-and-budgets.md)                    | Tests et budgets du web                                      |
| [0091](0091-web-observability.md)                        | Observabilité du web                                         |
