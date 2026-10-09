# 0116. Vues des publications signalées par le navigateur

Statut : acceptée (2026-10-09). Complète l'ADR 0034.

## Contexte

L'auteur d'une publication voit le nombre de membres uniques qui l'ont vue, par jour (§6.3, ADR 0034). L'api comptait comme vue chaque publication d'une page de fil renvoyée à un lecteur : vingt publications par page, dont la plupart ne passent jamais à l'écran (la page suivante est chargée avant d'y arriver, le fil virtualisé ne monte que les éléments proches). Le compte surestimait donc les vues, d'autant plus que le fil chargé d'avance s'allonge.

## Décision

- Une page du fil chargée n'est plus une vue. Le navigateur signale les publications vues : visibles à 50 % au moins pendant une seconde au moins (`IntersectionObserver`), regroupées et envoyées par `POST /v1/posts/views` (`{ postIds }`, 50 au plus par signal, `POST_VIEWS_MAX_PER_SIGNAL`), au plus toutes les quelques secondes et au départ de la page.
- La route est idempotente par nature : chaque membre compte une fois par publication et par jour (HyperLogLog), un signal répété ne change rien, sans `Idempotency-Key`. Elle est limitée à 30 signaux par minute et par membre (`@Throttle`), en plus de la limite générale.
- L'api ne croit pas le navigateur sur la visibilité : seules les publications que le membre peut lire (blocages, visibilité, modération) comptent, jamais les siennes ; une publication inconnue est ignorée sans erreur (un signal ne révèle rien).
- L'ouverture de la page d'une publication (`GET /v1/posts/{postId}`) reste une vue. Une lecture sans compte (`/v1/public/posts/{postId}`) n'en est pas une : le compte est celui de membres uniques.

## Conséquences

- Les statistiques mesurent ce qui a été vu, pas ce qui a été chargé ; un navigateur sans JavaScript ne signale rien (le fil exige JavaScript).
- Un membre ne peut gonfler les vues d'une publication que d'une unité par jour, comme avant.
- Tests : `test/integration/content.spec.ts` (fil chargé sans vue, signal répété compté une fois, vue de l'auteur ignorée, publication réservée aux connexions ignorée, 51 identifiants refusés), tests du signal groupé dans le web.
