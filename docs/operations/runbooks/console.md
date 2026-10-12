# Console d'administration : guide des modérateurs et administrateurs

La console (`/{locale}/admin`) est l'outil interne de la modération et de l'exploitation (§13, ADR 0078, ADR 0172). Les procédures détaillées par domaine restent dans les autres runbooks ; ce guide dit où les mener dans la console.

## Accès

- Rôle `moderator` ou `admin` (attribué par un administrateur dans la fiche d'un membre, ou `pnpm admin:create --email <email>`), double authentification active : sans elle, la console renvoie vers `/settings/security?required=two-factor` ; sans rôle, elle n'existe pas (404).
- Chaque écran et chaque action s'affichent selon les droits que l'api donne au lecteur (`GET /v1/admin/capabilities`) : une action absente n'est pas permise, une action désactivée dit pourquoi.
- Actions sensibles (attribution d'un rôle, remboursement, drapeau, suspension définitive, gel d'un projet, relance d'une tâche) : connexion de moins de 15 minutes par défaut (`ACCESS_REAUTHENTICATION_MAX_AGE_MINUTES`, durée affichée par la console). Sinon l'avis « Reconnectez-vous pour continuer » mène à une nouvelle connexion qui revient sur l'écran, l'action rouverte.
- Actions irréversibles ou destructrices : une phrase à saisir (la clé d'un drapeau, le nom d'une organisation, `REMBOURSER`, `PUBLIER`…).
- Les écrans de données personnelles portent la mention permanente « votre consultation est inscrite au journal d'audit » : chaque lecture l'est.
- Clavier : `?` liste les raccourcis ; `g d` tableau de bord, `g m` modération, `g a` appels, `g u` membres, `g p` contributions, `g j` tâches en échec, `g l` journal d'audit ; `/` met le curseur dans la recherche d'une liste.

## Journée d'un modérateur

1. Tableau de bord : les files du lecteur (signalements, appels, vérifications d'organisation) avec leur nombre ; chaque file s'ouvre d'un clic.
2. Modération (`/admin/moderation`) : la file par priorité ; filtres d'état, d'affectation, de cible, de motif et d'âge dans l'adresse (un lien filtré se partage). Les raisons d'une priorité s'affichent au survol et au clavier.
3. Dossier : s'affecter le dossier (ou l'affecter à un collègue), lire le contenu signalé, les signalements regroupés et, pour un message, son contexte limité (les quelques messages qui le précèdent).
4. Décider : choisir la décision parmi celles que l'api propose, le motif, puis partir du modèle d'exposé des motifs de ce motif et y décrire les faits constatés ; l'aperçu montre ce que reçoit la personne concernée. Fondement (conditions ou loi) et sa référence. Suspension : de 1 à 30 jours pour un modérateur ; au-delà, définitive ou gel d'un projet : administrateur.
5. Appels (`/admin/moderation/appeals`) : un appel ne se tranche jamais par l'auteur de la décision ; la console le dit et n'offre pas l'action. Maintenir ou annuler, avec une motivation que le membre lit.
6. Vérification des organisations (`/admin/organizations`) : ouvrir les pièces (adresse signée, jamais gardée), lire le signal du domaine (un indice, jamais une preuve), cocher les critères configurés, accorder ou refuser avec une motivation partagée aux propriétaires ; retirer un badge demande un motif et le nom de l'organisation saisi.
7. Mises en avant (`/admin/highlights`) : mettre en avant une publication, un projet ou un profil par son identifiant, remonter en tête, retirer.

## Journée d'un administrateur

- KYC (`/admin/payments/kyc`) : ouvrir la vérification, lire les pièces, approuver (les contributions des projets du porteur peuvent s'ouvrir) ou refuser avec un motif que le porteur reçoit.
- Remboursement (`/admin/payments/contributions`) : retrouver la contribution par son identifiant, l'identifiant public du contributeur ou la référence du paiement ; lire le devis et le ledger ; choisir total ou partiel, écrire le motif, « Voir l'effet » (commission rendue, euros retirés du collecté, état qui suit), puis rembourser avec la phrase et une session récente. Un remboursement ne s'annule pas.
- Contributions hors plateforme (`/admin/payments/offline`) : valider sur preuve (le montant entre dans le collecté) ou refuser avec un motif envoyé aux deux parties ; l'api refuse une validation sans preuve.
- Rapprochement (`/admin/payments/discrepancies`) : comprendre l'écart (attendu, constaté, contribution), le corriger par le flux normal (`reconciliation.md`), puis « Noter comme traité » avec la note ; « Lancer un rapprochement » refait le contrôle sur place.
- Méthodologie d'impact (`/admin/impact`) : créer un brouillon depuis la version publiée, modifier critères, poids et échelles, écrire les libellés de chaque langue active (la liste des manques ouvre la langue concernée), enregistrer, vérifier par l'aperçu du score, puis publier avec la phrase : une version publiée ne change plus et archive la précédente.
- Fonctionnalités (`/admin/flags`) : une langue ne s'active qu'avec un catalogue complet et une relecture humaine native enregistrée (swahili, wolof et lingala restent désactivés jusque-là) ; `funding.equity` et `funding.loans` demandent la référence de la validation juridique et n'ouvrent aucun paiement en ligne sans adaptateur agréé ; chaque changement demande la clé saisie et une session récente, et entre dans l'historique.
- Tâches en échec (`/admin/jobs`) : lire la raison et les données masquées, corriger la cause (`resilience.md`), puis relancer ; une tâche déjà relancée ou disparue ne l'est pas deux fois.
- Demandes de droits (`/admin/privacy`) : suivre l'échéance légale d'un mois ; une demande en retard s'affiche en danger ; procédure dans `rights-requests.md`.
- Membres (`/admin/members`) : fiche (identité, rôles, sessions, statut, décisions, contributions), attribution ou retrait d'un rôle (le membre doit activer sa double authentification avant d'entrer dans la console), révocation de toutes ses sessions, suspension temporaire ou, pour un administrateur, définitive.
- Journal d'audit (`/admin/audit`) : filtres d'auteur, d'action, de cible et de période (jours UTC) dans l'adresse, détail d'une entrée, export CSV des mêmes filtres (5 000 lignes au plus, export audité).

## En cas de doute

Une action refusée affiche le code et la raison de l'api : ne pas la contourner (aucune écriture en base). Un refus inattendu, une file qui ne se vide pas ou un écart inexpliqué relèvent d'un incident (`incident.md`).
