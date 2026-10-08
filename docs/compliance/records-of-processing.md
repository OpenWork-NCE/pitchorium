# Registre des traitements (brouillon)

> Brouillon technique au sens de l'article 30 du RGPD, établi d'après le code. **À valider par un délégué à la protection des données ou un conseil** : finalités, bases légales et durées marquées « à confirmer » ne sont pas des décisions. Responsable de traitement, représentant et DPO : à désigner (question 59).

## Traitements

| Traitement                  | Finalité                              | Personnes                | Données                                          | Base légale (à confirmer)           | Durée                  |
| --------------------------- | ------------------------------------- | ------------------------ | ------------------------------------------------ | ----------------------------------- | ---------------------- |
| Comptes et authentification | Créer et sécuriser l'accès            | Membres                  | Identité, email, sessions, méthodes de connexion | Contrat                             | `retention.md`         |
| Profils et réseau           | Réseau professionnel (§10)            | Membres                  | Profil, volets, relations, vues de profil        | Contrat                             | `retention.md`         |
| Publications et messagerie  | Fil et messages (§10.3, §10.4)        | Membres                  | Contenus, messages, fichiers                     | Contrat                             | `retention.md`         |
| Projets et contributions    | Financement à impact (§9, §11)        | Porteurs, contributeurs  | Projets, contributions, compte de versement, KYC | Contrat, obligation légale          | `retention.md`         |
| Recherche et suggestions    | Découverte (§10.6, §11.4)             | Membres                  | Projection des profils et contenus               | Intérêt légitime                    | Projection             |
| Notifications et emails     | Informer (§10.5)                      | Membres                  | Notifications, préférences, adresse              | Contrat                             | `retention.md`         |
| Modération                  | Confiance et sécurité (§13, DSA)      | Membres, notifiants      | Signalements, décisions, suspensions             | Obligation légale, intérêt légitime | `retention.md`         |
| Droits RGPD                 | Export, suppression (§13)             | Membres                  | Demandes, archives                               | Obligation légale                   | `retention.md`         |
| Traduction à la demande     | Lire un contenu dans sa langue (§8.3) | Membres                  | Texte envoyé au prestataire sur action du membre | Contrat                             | Cache sans identifiant |
| Journal d'audit et sécurité | Preuve et sécurité                    | Membres, administrateurs | Actions, identifiants                            | Intérêt légitime                    | `retention.md`         |

## Sous-traitants et destinataires

| Sous-traitant                                               | Rôle                                                       | Données                                          | Localisation (à confirmer)       |
| ----------------------------------------------------------- | ---------------------------------------------------------- | ------------------------------------------------ | -------------------------------- |
| Stripe                                                      | Paiements, comptes connectés, KYC des porteurs sur ce rail | Contributeur, porteur, paiement                  | UE, États-Unis                   |
| Flutterwave                                                 | Paiements Afrique, Mobile Money, sous-comptes              | Contributeur, porteur, paiement                  | Nigeria, autres pays d'Afrique   |
| Resend                                                      | Envoi des emails transactionnels et des notifications      | Adresse, nom, contenu des emails                 | À confirmer                      |
| Cloudflare (R2, CDN)                                        | Stockage des fichiers, diffusion des fichiers publics      | Fichiers, adresses IP des visiteurs              | À confirmer                      |
| Prestataire de traduction (DeepL, Google Cloud Translation) | Traduction à la demande                                    | Texte du contenu traduit                         | UE (DeepL), à confirmer (Google) |
| Hébergeur (à définir)                                       | Conteneurs, PostgreSQL, Redis                              | Toutes les données                               | Question 24                      |
| Outils d'observabilité (OpenTelemetry, Sentry, à définir)   | Traces et erreurs                                          | Identifiants techniques, sans données de contenu | Question 26                      |

Fournisseurs d'identité (Google, LinkedIn, Microsoft) : responsables de traitement distincts pour la connexion. Have I Been Pwned : seuls les 5 premiers caractères de l'empreinte SHA-1 du mot de passe sont envoyés (k-anonymat).

## Mesures de sécurité (article 32)

Chiffrement en transit (TLS), sessions `HttpOnly`, double authentification obligatoire des rôles privilégiés, refus par défaut des autorisations, journal d'audit, antivirus et suppression des métadonnées des fichiers, URL présignées courtes pour les fichiers privés, pseudonymisation des données conservées après suppression. La liste de contrôle OWASP ASVS est tenue dans `docs/security/asvs.md`.
