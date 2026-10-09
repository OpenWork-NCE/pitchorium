# 0115. Adresse du visiteur relayée par le serveur du web

Statut : acceptée (2026-10-09). Ferme la question ouverte 113. Complète l'ADR 0114.

## Contexte

Une page rendue par le serveur du web (Server Components) appelle l'api depuis l'adresse de ce serveur. Avec une session, la requête est comptée par session (ADR 0114) ; sans session, tous les visiteurs des pages publiques (profil, organisation, projet, publication) partageaient la limite de l'adresse du serveur du web : quelques visiteurs suffisaient à faire répondre 429 à tous les autres. Exempter le serveur du web aurait retiré toute limite aux pages publiques, et un en-tête `X-Forwarded-For` ajouté par le web ne prouverait rien : n'importe quel client peut l'écrire.

## Décision

- Le serveur du web joint à chaque appel de l'api l'adresse du visiteur dans l'en-tête `X-Pitchorium-Client-Address` : `<adresse>;<horodatage en millisecondes>;<signature>`, la signature étant un HMAC-SHA256 de `<adresse>;<horodatage>` par un secret partagé (`WEB_CLIENT_ADDRESS_SECRET`, dans l'api et dans le web, 32 caractères au moins), encodé en base64url.
- L'api (`platform/http/client-address.ts`) n'accepte l'en-tête que bien formé, avec une adresse IP valide, signé par ce secret et récent : 30 secondes au plus après la signature, 5 secondes d'avance au plus pour les horloges. Elle ne s'en sert que pour la limitation de débit (`HttpThrottlerGuard`) : une session signée d'abord (ADR 0114), puis l'adresse relayée, puis l'adresse de la requête. Tout autre usage de l'adresse (sessions de Better Auth, journaux) l'ignore. Sans secret configuré, l'en-tête est toujours ignoré.
- Le web lit l'adresse du visiteur dans `X-Forwarded-For` selon le nombre de proxys de confiance placés devant lui (`WEB_TRUST_PROXY_HOPS`, même sens que `TRUST_PROXY_HOPS` de l'api et `trust proxy` d'Express : avec N proxys, l'adresse vue par le plus extérieur, N-ième en partant de la droite). À 0 (défaut, développement), il ne relaie rien : Next.js n'écrit `X-Forwarded-For` que si le client ne l'a pas fait, la valeur n'est donc pas sûre sans proxy.
- Configuration de production (`docs/operations/deployment.md`) : chaque proxy devant le web (CDN, reverse proxy, plateforme) ajoute l'adresse qu'il voit à `X-Forwarded-For` ou la remplace ; `WEB_TRUST_PROXY_HOPS` compte ces proxys, `TRUST_PROXY_HOPS` ceux devant l'api.

## Conséquences

- Deux visiteurs derrière le même serveur du web ont chacun leur limite ; un en-tête falsifié, modifié ou expiré compte sur l'adresse du serveur du web, comme avant.
- Un secret fuité permettrait seulement de répartir ses requêtes sur des adresses inventées, comme sans en-tête un client qui change d'adresse : il se change dans les deux applications.
- Tests : `client-address.spec.ts` et `http-throttler.guard.spec.ts` (format, signature, durée), `test/integration/rate-limit.spec.ts` (en-tête valide, falsifié, modifié, expiré, deux visiteurs derrière le même serveur), `lib/api/client-address.spec.ts` dans le web (choix de l'adresse selon les proxys).
