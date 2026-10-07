# 0015. Modèle d'autorisation

Statut : acceptée (2026-10-07)

## Contexte

Les droits combinent des rôles de plateforme, des niveaux de confiance (email vérifié, KYC, suspension), la propriété des ressources, l'acceptation des conditions et des éléments de profil à compléter au moment où ils servent (cahier des charges §7.2 étape 4). Une route oubliée ne doit jamais être ouverte par défaut.

## Décision

- Refus par défaut : un garde global (module access) exige une session sur toute route non marquée `@Public()`, puis une action déclarée par `@RequireAction(action, { resource })` ; une route protégée sans action est refusée.
- Les décorateurs (`@Public`, `@RequireAction`, `@CurrentPrincipal`) et le type `ProtectedResource` sont des métadonnées de `platform/http`, utilisables par tous les modules, y compris identity, sans dépendre de access ; le module access les applique.
- Registre central et typé des politiques (`ACTION_POLICIES`, noms dans `@pitchorium/contracts`) : rôles admis, propriété (`self`), prérequis, conditions acceptées, suspension, audit des refus. La décision (`decide`) est une fonction pure du domaine, testée par une matrice action × type d'acteur ; le service applicatif ne charge que les faits nécessaires.
- Ordre des refus : `UNAUTHENTICATED`, `ACCESS_ACCOUNT_SUSPENDED`, `FORBIDDEN` (rôle ou propriété), puis `ACCESS_PREREQUISITES_MISSING` avec la liste complète `missing`, pour que le frontend ouvre le bon formulaire.
- Un rôle privilégié (`moderator`, `admin`) exige la double authentification (`two_factor` manquant sinon). L'attribution d'un rôle ferme les sessions du titulaire.
- Les éléments `profile.*` sont fournis par le module profiles via un `PrerequisiteProvider` enregistré au démarrage : access ne dépend d'aucun module au-dessus de lui ; un élément sans fournisseur compte comme manquant.
- Ports KYC et suspension avec adaptateurs par défaut sûrs (jamais vérifié, jamais suspendu) jusqu'aux modules payments et trust.

## Conséquences

- Chaque nouvelle route déclare son action ; chaque nouvelle action ajoute sa politique et sa ligne dans la matrice de tests.
- Les modules identity, access et profiles sont des modules Nest globaux pour l'injection de leurs façades ; les imports restent contrôlés par ESLint (ADR 0010).
