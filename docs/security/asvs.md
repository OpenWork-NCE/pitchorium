# OWASP ASVS 4.0.3, niveau 2

État de l'api au 2026-10-08, par section de l'ASVS (granularité : la section ; une exigence d'une section couverte qui ne s'applique pas est signalée dans la colonne Preuve). Statuts : **Couvert** (avec sa preuve), **N/A** (avec sa justification), **Reporté** (avec la question ouverte qui le porte). Le frontend n'existe pas encore : les exigences propres au navigateur (V5.3 en partie, V14.4 côté pages) seront à reprendre avec lui.

## V1 Architecture, conception, modélisation des menaces

| Section                              | Statut  | Preuve ou justification                                                                                                                     |
| ------------------------------------ | ------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| V1.1 Cycle de développement sécurisé | Couvert | ADR (`docs/adr`), revue de sécurité (`docs/security/review.md`), CI avec analyses (gitleaks, CodeQL, osv-scanner, licences, Trivy)          |
| V1.2 Authentification                | Couvert | Better Auth seul point d'authentification (ADR 0013), garde global (ADR 0015)                                                               |
| V1.4 Contrôle d'accès                | Couvert | Registre central des actions, refus par défaut, matrice testée (`access-policy.spec.ts`), inventaire des routes (`route-inventory.spec.ts`) |
| V1.5 Entrées et sorties              | Couvert | Contrats Zod partagés (ADR 0003), erreurs RFC 9457 (ADR 0020)                                                                               |
| V1.6 Cryptographie                   | Couvert | Aucune cryptographie maison : Better Auth (scrypt), HMAC SHA-256 des liens d'email, TLS au proxy                                            |
| V1.7 Journaux                        | Couvert | pino JSON, masquage (`log-redaction.ts`), journal d'audit en base                                                                           |
| V1.8 Protection des données          | Couvert | Registre de conservation, pseudonymisation, export et suppression (ADR 0074, 0075)                                                          |
| V1.9 Communications                  | Couvert | TLS terminé au proxy (Caddy, HSTS), connexions aux prestataires en HTTPS                                                                    |
| V1.10 Code malveillant               | Couvert | Versions figées (ADR 0012), délai minimal de publication (pnpm `minimumReleaseAge`), audit des dépendances                                  |
| V1.11 Logique métier                 | Couvert | Machines à états des domaines testées (paiements, modération, RGPD)                                                                         |
| V1.12 Téléversement                  | Couvert | URL présignées, quarantaine, antivirus, type réel (ADR 0022, 0023)                                                                          |
| V1.14 Configuration                  | Couvert | Configuration validée au démarrage, secrets hors dépôt, image distroless non root                                                           |

## V2 Authentification

| Section                                      | Statut  | Preuve ou justification                                                                              |
| -------------------------------------------- | ------- | ---------------------------------------------------------------------------------------------------- |
| V2.1 Mots de passe                           | Couvert | 12 caractères minimum, pas de règle de composition, vérification Have I Been Pwned (identity README) |
| V2.2 Authentification générale               | Couvert | Limitation de débit Better Auth, email de nouvelle connexion, 2FA pour les rôles privilégiés         |
| V2.3 Cycle de vie des authentifiants         | Couvert | Liens de réinitialisation à usage unique (30 min), fermeture des sessions après réinitialisation     |
| V2.4 Stockage des authentifiants             | Couvert | Hachage scrypt de Better Auth, jamais exporté (`identity-personal-data.ts`)                          |
| V2.5 Récupération                            | Couvert | Réinitialisation par email seulement, pas de question secrète                                        |
| V2.6 Secrets de recherche (codes de secours) | Couvert | Codes de secours TOTP de Better Auth                                                                 |
| V2.7 Hors bande (lien magique)               | Couvert | Lien magique à usage unique, durée courte                                                            |
| V2.8 TOTP                                    | Couvert | Plugin `two-factor` de Better Auth, verrouillage après échecs                                        |
| V2.9 Cryptographique (clés matérielles)      | N/A     | Non proposé (pas de WebAuthn dans le périmètre)                                                      |
| V2.10 Comptes de service                     | Couvert | Aucun compte de service applicatif ; clés de prestataires en secrets                                 |

## V3 Sessions

| Section             | Statut  | Preuve ou justification                                                                                   |
| ------------------- | ------- | --------------------------------------------------------------------------------------------------------- |
| V3.1 Fondamentaux   | Couvert | Jeton jamais dans l'URL                                                                                   |
| V3.2 Liaison        | Couvert | Nouvelle session à chaque connexion, rotation à l'élévation de privilège (`revokeAllSessions`)            |
| V3.3 Fin de session | Couvert | Déconnexion, révocation unitaire et globale, expiration glissante de 30 jours, révocation à la suspension |
| V3.4 Cookies        | Couvert | `HttpOnly`, `Secure`, `SameSite=Lax`, préfixe `__Secure-`                                                 |
| V3.5 Jetons         | N/A     | Pas de jeton porteur exposé aux clients                                                                   |
| V3.7 Défense        | Couvert | Session récente exigée pour les actions sensibles (`recentAuthentication`)                                |

## V4 Contrôle d'accès

| Section         | Statut  | Preuve ou justification                                                       |
| --------------- | ------- | ----------------------------------------------------------------------------- |
| V4.1 Conception | Couvert | Refus par défaut, politique par action (ADR 0015)                             |
| V4.2 Opérations | Couvert | Résolveurs de ressources (404 si invisible), tests IDOR (`idor.spec.ts`)      |
| V4.3 Autres     | Couvert | Administration sous 2FA, lectures de données personnelles auditées (ADR 0078) |

## V5 Validation, assainissement, encodage

| Section                     | Statut  | Preuve ou justification                                                                             |
| --------------------------- | ------- | --------------------------------------------------------------------------------------------------- |
| V5.1 Validation des entrées | Couvert | Zod sur chaque entrée, clés inconnues refusées, longueurs bornées (`contracts.spec.ts`)             |
| V5.2 Assainissement         | Couvert | Markdown restreint, aperçus de liens filtrés, fichiers réencodés sans métadonnées                   |
| V5.3 Encodage de sortie     | Couvert | JSON uniquement ; emails rendus par React Email (échappement) ; l'affichage HTML relève du frontend |
| V5.4 Mémoire                | N/A     | Langage géré (Node.js)                                                                              |
| V5.5 Désérialisation        | Couvert | JSON seulement, pas de désérialisation d'objets ; montants en chaînes, jamais en flottants          |

## V6 Cryptographie stockée

| Section                  | Statut  | Preuve ou justification                                                                                               |
| ------------------------ | ------- | --------------------------------------------------------------------------------------------------------------------- |
| V6.1 Classification      | Couvert | Registre des traitements (brouillon), registre de conservation                                                        |
| V6.2 Algorithmes         | Couvert | Bibliothèques éprouvées (Better Auth, `node:crypto`)                                                                  |
| V6.3 Aléatoire           | Couvert | `crypto.randomUUID`, UUIDv7, jetons de Better Auth                                                                    |
| V6.4 Gestion des secrets | Reporté | Gestionnaire de secrets de l'hébergeur à choisir (question 24) ; rotation documentée (`runbooks/secrets-rotation.md`) |

## V7 Erreurs et journaux

| Section                      | Statut  | Preuve ou justification                                                     |
| ---------------------------- | ------- | --------------------------------------------------------------------------- |
| V7.1 Contenu des journaux    | Couvert | Ni email, ni jeton, ni secret, ni donnée de carte (`log-redaction.spec.ts`) |
| V7.2 Événements journalisés  | Couvert | Journal d'audit des actions sensibles et des refus                          |
| V7.3 Protection des journaux | Reporté | Stockage et accès des journaux selon l'hébergeur (questions 24 et 26)       |
| V7.4 Gestion des erreurs     | Couvert | `INTERNAL_ERROR` sans détail, Sentry, identifiant de requête                |

## V8 Protection des données

| Section                | Statut  | Preuve ou justification                                                                               |
| ---------------------- | ------- | ----------------------------------------------------------------------------------------------------- |
| V8.1 Généralités       | Couvert | `Cache-Control` adapté sur les routes publiques, pas de cache des réponses authentifiées par le proxy |
| V8.2 Côté client       | Reporté | À vérifier avec le frontend (aucune donnée sensible en stockage local, `docs/frontend-handoff.md`)    |
| V8.3 Données sensibles | Couvert | Droits RGPD, minimisation des payloads d'événements, pseudonymisation, URL présignées courtes         |

## V9 Communications

| Section      | Statut  | Preuve ou justification                                                                                       |
| ------------ | ------- | ------------------------------------------------------------------------------------------------------------- |
| V9.1 Client  | Couvert | TLS au proxy, HSTS `preload`                                                                                  |
| V9.2 Serveur | Couvert | Prestataires en HTTPS ; base et Redis managés en TLS à exiger de l'hébergeur (`docs/production-readiness.md`) |

## V10 Code malveillant

| Section                          | Statut  | Preuve ou justification                                                       |
| -------------------------------- | ------- | ----------------------------------------------------------------------------- |
| V10.1 Intégrité du code          | Couvert | Analyse CodeQL, recherche de secrets                                          |
| V10.2 Code malveillant           | Couvert | Dépendances figées, audit et SBOM CycloneDX en CI                             |
| V10.3 Intégrité de l'application | Couvert | Image construite en CI depuis le dépôt, versions sémantiques (release-please) |

## V11 Logique métier

| Section                      | Statut  | Preuve ou justification                                                                                                                             |
| ---------------------------- | ------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| V11.1 Sécurité de la logique | Couvert | Idempotence des écritures, limites anti-abus, verrous transactionnels (contreparties, signalements), seuils de vérification renforcée des paiements |

## V12 Fichiers et ressources

| Section              | Statut  | Preuve ou justification                                            |
| -------------------- | ------- | ------------------------------------------------------------------ |
| V12.1 Téléversement  | Couvert | Taille signée dans l'URL, quotas, contrôle de taille par le worker |
| V12.2 Intégrité      | Couvert | Type réel détecté, antivirus, réencodage                           |
| V12.3 Exécution      | Couvert | Aucun fichier exécuté ni servi par l'api ; clés générées           |
| V12.4 Stockage       | Couvert | Bucket privé, quarantaine, buckets séparés public et privé         |
| V12.5 Téléchargement | Couvert | URL présignées courtes, contrôle délégué au module propriétaire    |
| V12.6 SSRF           | Couvert | Client HTTP sortant filtré (ADR 0033)                              |

## V13 API et services web

| Section           | Statut  | Preuve ou justification                                                                            |
| ----------------- | ------- | -------------------------------------------------------------------------------------------------- |
| V13.1 Généralités | Couvert | Même validation, même garde sur toutes les routes, OpenAPI généré                                  |
| V13.2 REST        | Couvert | Méthodes cohérentes, `Content-Type` JSON exigé, corps limité à 1 Mo, protection CSRF par l'origine |
| V13.3 SOAP        | N/A     | Aucun service SOAP                                                                                 |
| V13.4 GraphQL     | N/A     | Aucun GraphQL                                                                                      |

## V14 Configuration

| Section                       | Statut  | Preuve ou justification                                                                  |
| ----------------------------- | ------- | ---------------------------------------------------------------------------------------- |
| V14.1 Construction            | Couvert | Image multi-étapes reproductible, CI                                                     |
| V14.2 Dépendances             | Couvert | Audit des dépendances, licences AGPL et GPL refusées à l'exécution, SBOM                 |
| V14.3 Fuite d'information     | Couvert | `X-Powered-By` retiré, erreurs sans détail technique, Swagger UI désactivé en production |
| V14.4 En-têtes HTTP           | Couvert | helmet (`review.md`)                                                                     |
| V14.5 Validation des en-têtes | Couvert | `Origin` de confiance pour les écritures par cookie, CORS en liste blanche               |
