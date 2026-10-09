# 0118. Aperçu d'un lien avant la publication

Statut : acceptée (2026-10-09). Complète l'ADR 0033.

## Contexte

L'aperçu d'un lien (titre, description, site, image) était construit par le worker après la publication (ADR 0033). Le composeur doit le montrer dès qu'une adresse est collée, avec un état d'attente puis l'aperçu, et permettre de le retirer. Le navigateur ne peut pas lire la page lui-même (CORS, et ce serait révéler l'adresse du membre au site), ni afficher l'image du site tiers (règle de l'ADR 0033 et politique de sécurité du contenu).

## Décision

- `POST /v1/link-previews` (`{ url }`, http ou https, action `content.post.create`, 20 par minute et par membre) enregistre un aperçu `pending` pour son auteur et un événement interne (`content.link-preview.requested.v1`) ; le worker le construit exactement comme celui d'une publication : page lue par le client protégé contre le SSRF, balises Open Graph, image importée par le module media (usage `link_preview`). `GET /v1/link-previews/{id}` le relit, pour son auteur seulement (404 sinon), jusqu'à `ready` ou `failed` ; l'image est servie par la plateforme (URL présignée), jamais par le site.
- La publication qui porte `linkPreviewId` avec le même `linkUrl` reprend l'aperçu construit (statut, textes, image attachée tout de suite si elle est prête, sinon à son arrivée) et le consomme ; un aperçu d'un autre membre, d'une autre adresse ou encore en attente est ignoré, et la publication construit le sien comme avant.
- Retirer l'aperçu dans le composeur, c'est publier sans `linkUrl` : le lien reste dans le texte.
- Un aperçu non publié est supprimé après 24 heures (tâche `purge-link-previews`, chaque heure) ; son image importée, jamais attachée, est supprimée par le nettoyage des orphelins du module media. L'effacement d'un compte supprime ses aperçus (registre de conservation).

## Conséquences

- L'auteur voit l'aperçu avant de publier, sans requête vers le site depuis son navigateur ; la publication ne refait pas le travail.
- Une page lue deux fois si l'auteur change d'adresse, au plus vingt par minute.
- Tests : `test/integration/content.spec.ts` (aperçu réservé à son auteur, construit avec son image, repris par la publication puis consommé, adresse différente ignorée, protocole refusé).
