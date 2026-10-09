# 0101. Une adresse par ressource

Statut : acceptée (2026-10-08), révisée le 2026-10-09 (plan du site). Ferme les questions 103 et 104.

## Contexte

L'espace membre occupait `/projects` et `/profile`, alors que les pages publiques d'un projet et d'un profil doivent se partager et s'indexer (§6.1, §10.1, §10.7, §11.2). Deux groupes de routes ne peuvent servir le même chemin ; deux adresses pour une même ressource (une publique, une membre) dispersent les liens partagés, le référencement et les notifications.

## Décision

- Une seule adresse canonique par ressource, la même pour un visiteur et pour un membre, dans le groupe `(public)` : `/{locale}/members/{handle}`, `/{locale}/organizations/{slug}`, `/{locale}/projects/{slug}`, `/{locale}/events/{slug}`, et la vitrine `/{locale}/projects`, publique et indexable. Chemins non traduits (ADR 0092), aides `routes.member`, `routes.organization`, `routes.project`, `routes.event`.
- La mise en page du groupe suit la session (`getCurrentMember`, qui ne sollicite pas l'api sans cookie de session) : le cadre de l'espace membre pour un membre, le cadre public pour un visiteur.
- Règles de rendu (`lib/resources/view.ts`) : un membre lit la ressource comme membre (`GET /v1/profiles/{handle}`, `/v1/organizations/by-slug/{slug}`, `/v1/projects/by-slug/{slug}`, `/v1/events/by-slug/{slug}`, vue enrichie, ou ressource réservée aux membres) ; un visiteur lit sa vue publique (`GET /v1/public/...`). Une ressource absente pour le lecteur (404 ou 403 de l'api) répond 404 : un brouillon, un profil sans page publique ou un événement réservé aux membres n'existe pas pour un visiteur, et s'affiche normalement pour un membre autorisé, à la même adresse.
- Indexation : la vue publique est indexée (`index, follow`), avec son adresse canonique et les alternatives des langues actives ; la vue membre ne l'est jamais (un robot n'a pas de session). Le groupe n'a pas d'écran de chargement : la page attend sa ressource, et un 404 est un vrai statut 404, pas une page d'erreur servie en 200.
- `/{locale}/profile` (« Profil » du bandeau) redirige vers `/{locale}/members/{handle}` du membre connecté ; `projects` sort des segments réservés à l'espace membre (`MEMBER_SEGMENTS`).
- Sitemap : la page d'accueil, la vitrine, puis les projets de la vitrine publique, les événements publics, les profils dont la page publique est ouverte (`GET /v1/public/profiles`) et les organisations (`GET /v1/public/organizations`), listes publiques paginées de l'api ; jamais une vue membre. `robots.txt` autorise les pages de ressources.
- Partage : un profil public et une organisation ont leurs images Open Graph et X (nom, titre ou type de structure), lues dans leur vue publique seulement ; une page fermée aux visiteurs partage l'image par défaut de la langue.
- Contenu des pages : la structure, les coquilles et les règles de rendu sont livrées ici ; chaque page arrive avec son PROMPT FRONT.

## Conséquences

- Un lien partagé, un email ou une notification mènent à la même adresse, quel que soit le lecteur.
- Le JavaScript initial du groupe `(public)` réunit, au sens du manifeste du build, les deux cadres ; un visiteur ne télécharge que celui qu'il reçoit, Socket.IO et le client d'authentification restant chargés à la demande.
- Une page de ressource lit l'api à chaque requête (`no-store`) : la mise en cache des vues publiques (CDN, revalidation) sera décidée avec leur contenu.
