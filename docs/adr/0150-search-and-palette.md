# 0150. Recherche, palette de commandes et page Découvrir

Statut : acceptée (2026-10-11).

## Contexte

Le §10.6 demande une barre qui trouve personnes, organisations et projets, des filtres de projets et une page Découvrir en grilles larges ; l'api livre la recherche tolérante aux fautes, l'autocomplétion et les sections de Découvrir (ADR 0065 à 0068). La coquille de la palette (FRONT 1) attendait ses résultats.

## Décision

- Palette (Ctrl K, Cmd K) : l'autocomplétion de l'api (`GET /v1/discovery/autocomplete`, ou sa version publique), une requête par pause de 150 ms, regroupée par type (personnes, organisations, projets, événements, missions) ; les mots de la requête en gras au début des mots du titre, accents et casse ignorés (`lib/search/highlight.ts`), sans rien marquer d'un titre trouvé malgré une faute ; la liste garde sa hauteur pendant l'arrivée des résultats (aucun saut) et les résultats précédents restent jusqu'aux suivants. Puis « Rechercher » (page de résultats), les actions rapides et les recherches récentes. La palette, ses actions et leurs icônes ne sont jamais dans un premier chargement : la coquille la compose (`MemberPalette`) et la charge à l'inactivité.
- Recherches récentes : six au plus, sur l'appareil (stockage local), jamais envoyées, effacées à la déconnexion.
- Page de résultats `/search` : une adresse pour le visiteur (documents publics) et le membre ; la requête, l'onglet du type et les filtres sont dans l'adresse (`nuqs`), chaque changement rendu par le serveur ; un filtre propre à un type n'existe que dans son onglet. L'api ne donne pas de nombre de résultats par type : les onglets n'en affichent pas. Sans résultat, la page propose une recherche plus large (sans les filtres, puis le mot le plus long, puis tous les types) et des liens vers Découvrir, les projets, les événements et les missions. Une page de résultats d'une requête n'est jamais indexée (`noindex, follow`) ; la page de recherche vide l'est.
- `/discover` : les sections de l'api dans son ordre, chacune avec sa grille (trois ou quatre colonnes sur ordinateur, jamais un carrousel), son état vide et sa page paginée (`/discover/{section}`) ; les profils suggérés d'un membre portent leur phrase de raison et « Se connecter » ; la vue visiteur révèle chaque section à l'approche (D4 par CSS, sans GSAP).
- Les valeurs des contrats lues par ces pages sont recopiées dans `features/discovery/lib/kinds.ts`, égales aux contrats par un test : aucune constante des contrats n'apporte Zod.

## Conséquences

- Les filtres « format » d'une mission (session ou mission courte) n'existent pas dans la recherche de l'api : la page filtre les missions par sens, domaine, mode et langue.
- Découvrir n'est pas une septième section du bandeau (ADR 0099) : on y accède par la palette, le menu du compte et le panneau du téléphone.
