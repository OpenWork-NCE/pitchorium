# 0025. Membres et vérification des organisations

Statut : acceptée (2026-10-07)

## Contexte

Une fondation, une entreprise ou une ONG a une page à elle (cahier des charges §10.7), gérée par plusieurs personnes, et un badge de vérification utile à la confiance (§13, §14). Le cahier des charges ne précise ni les rôles internes, ni le processus de vérification, ni ses critères.

## Décision

- Rôles internes distincts des rôles de plateforme : `owner`, `admin`, `member`. Le module access les applique par `resourceRoles` : le résolveur de ressource du module organizations donne le rôle du membre dans l'organisation visée (ADR 0015 étendue), et le service applique les règles fines (un `admin` ne touche pas un `owner`, toujours au moins un `owner`) sous un verrou transactionnel par organisation.
- Invitations liées à une adresse email : jeton aléatoire à usage unique et durée limitée, créé par le worker à l'envoi de l'email pour ne jamais transiter par l'outbox, stocké sous forme d'empreinte. L'acceptation exige un compte dont l'email vérifié est l'adresse invitée : un jeton intercepté ne suffit pas.
- Vérification : machine à états `unverified`, `pending`, `verified`, `rejected`, `revoked` ; demande par un `owner` avec déclaration et pièces privées (module media, lecture déléguée au module organizations) ; signal automatique non décisif (email vérifié d'un membre sur le domaine du site) ; décision motivée par un `moderator` ou un `admin` avec double authentification ; révocation ; audit de chaque étape.
- Critères de vérification configurables (`ORGANIZATIONS_VERIFICATION_CRITERIA`), vides par défaut : aucun critère n'est inventé ; un relecteur ne peut cocher qu'un critère configuré.
- Le module profiles ne dépend pas d'organizations : organizations lui enregistre un annuaire au démarrage (validation et affichage de l'organisation du volet contributeur), comme les prérequis du module access. Le graphe des dépendances reste acyclique.
- Projets portés et soutenus : point d'extension (`registerProjectsProvider`) rempli plus tard par projects et payments ; aucune donnée fictive.

## Conséquences

- Le badge n'est affiché qu'au statut `verified` ; une demande refusée ou une révocation laisse déposer une nouvelle demande.
- Un `admin` de plateforme sans double authentification ne peut ni relire une demande ni lire ses pièces.
- La liste des critères et le processus de validation restent à fournir (questions ouvertes) ; le flux fonctionne avec une liste vide.
