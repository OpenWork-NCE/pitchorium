# 0069. Périmètre des événements

Statut : proposée, à valider avec le client (2026-10-08).

## Contexte

Le cahier des charges cite les événements au périmètre V3 (§14) sans aucune description fonctionnelle (question ouverte 17). Il faut un périmètre utile au réseau d'affaires, cohérent avec le reste de la plateforme (publications, projets, organisations) et facile à réduire ou étendre une fois le besoin précisé.

## Décision

- Un événement est organisé par un membre, en son nom ou au nom d'une organisation dont il est `owner` ou `admin` ; il peut être rattaché à un projet dont il est membre de l'équipe. Les `owner` et `admin` de l'organisation organisatrice le gèrent aussi.
- Contenu : titre, slug avec historique, description en Markdown restreint (sous-ensemble des projets), type `online`, `in_person` ou `hybrid`, début et fin en UTC avec le fuseau IANA du lieu, lieu, lien de connexion révélé aux seuls inscrits, langue, secteurs, pays, image, capacité.
- Visibilité `public` ou `members` avec la règle des publications (ADR 0031) : public seulement avec un organisateur public.
- Cycle de vie `draft`, `published`, `canceled`, `completed` ; l'annulation notifie les inscrits et la liste d'attente ; `completed` est posé par une tâche planifiée.
- Inscription gratuite avec liste d'attente et promotion automatique (ADR 0070) ; rappels par le module notifications avec un délai configurable ; export iCalendar par événement et flux personnel par jeton révocable.
- Fil : les abonnés de l'organisateur voient ses nouveaux événements (élément `event`). Le suivi d'un événement par le registre de network n'est pas retenu : l'inscription exprime déjà l'intérêt et porte les notifications utiles ; un suivi ajouterait un second état à expliquer.
- `moderation_status` modifiable par la façade (module trust).

## Conséquences

- Tout ce périmètre est provisoire : chaque élément est listé dans `docs/open-questions.md` et peut être retiré sans migration de données des autres modules.
- Les événements récurrents, la billetterie, les co-organisateurs nommés, les questions d'inscription et le contrôle d'accès sur place ne sont pas couverts.
