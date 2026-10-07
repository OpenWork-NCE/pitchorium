# Graphe social et fil d'actualité

Le module network porte le graphe social (suivis, connexions, blocages, vues de profil), le module content les publications et le fil. content lit le graphe par la façade de network, jamais par ses tables ; les vues de profil sont signalées par profiles à network par un point d'extension.

## Modèle du graphe

```mermaid
erDiagram
  MEMBER ||--o{ FOLLOW : "suit (unilatéral)"
  FOLLOW }o--|| TARGET : "cible générique"
  TARGET ||--|| MEMBER : "member"
  TARGET ||--|| ORGANIZATION : "organization"
  TARGET ||--|| PROJECT : "project (module projects)"
  MEMBER ||--o{ CONNECTION_REQUEST : "demande (note de 300 caractères)"
  CONNECTION_REQUEST ||--o| CONNECTION : "acceptée"
  CONNECTION ||--|{ FOLLOW : "crée le suivi mutuel"
  MEMBER ||--o{ BLOCK : "bloque"
  MEMBER ||--o{ PROFILE_VIEW : "visite (normale ou privée)"
```

- Suivi : `network.follows` (abonné, `target_type`, `target_id`), types enregistrés par les modules propriétaires (ADR 0027).
- Connexion : demande unique en attente par paire, acceptation, une ligne par sens dans `network.connections`, suivi mutuel d'origine `connection` (ADR 0028).
- Blocage : supprime connexion, suivis et demandes entre les deux membres, masque leurs contenus et interdit les interactions (ADR 0029).
- Relation affichée sur un profil : degré jusqu'au 2e, connexions en commun plafonnées, état de la connexion, suivis, blocage.
- Vues de profil : tampon Redis dédupliqué par jour, écriture par lots par le worker, visite privée anonymisée (ADR 0030).

## Flux d'une publication jusqu'au fil

```mermaid
sequenceDiagram
  participant A as Auteur
  participant API as api (content)
  participant DB as PostgreSQL
  participant W as worker
  participant L as Lecteur
  A->>API: POST /v1/posts (texte, images, lien, visibilité)
  API->>API: visibilité permise, mentions résolues, blocages, langue
  API->>DB: posts, mentions, attachement des fichiers (media), content.post.created.v1
  API-->>A: 201 (aperçu de lien pending)
  Note over DB,W: relais de l'outbox, handler content.queue-link-preview
  W->>W: page lue par le client anti-SSRF, balises Open Graph
  W->>DB: aperçu ready, import de l'image (media, usage link_preview)
  L->>API: GET /v1/feed
  API->>API: suivis, connexions, blocages (façade network)
  API->>DB: LATERAL par auteur suivi (index partiel du fil), fusion, coupe
  API->>DB: auteurs, fichiers, mentions, compteurs, état du lecteur
  API-->>L: éléments post, repost, featured (schemaVersion 1)
  API->>API: HyperLogLog des vues (Redis), consolidé toutes les 10 minutes
```

## Règles appliquées à la lecture

- Visibilité effective : `public` se lit `members` si l'auteur a désactivé sa page publique (ADR 0031).
- Audience : `public` (aussi sans compte), `members`, `connections` (auteur et connexions).
- Blocages dans les deux sens, publications masquées par le lecteur, statut de modération (`hidden` visible de l'auteur seul, `removed` de personne).
- Repartage : jamais au-delà de l'audience de l'original ; l'original invisible donne `repostOf: null`.
- Complément éditorial quand le réseau produit moins que le seuil configuré, jamais de fil mondial anonyme (ADR 0032).
