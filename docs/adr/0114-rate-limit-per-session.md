# 0114. Limitation de débit par session

Statut : acceptée (2026-10-09).

## Contexte

L'api limite le débit de chaque client (`RATE_LIMIT_MAX` requêtes par `RATE_LIMIT_TTL_SECONDS`, Redis). Jusqu'ici, le client était son adresse IP. Les pages rendues par le serveur du web (Server Components) appellent l'api depuis l'adresse de ce serveur, au nom de chaque membre : toutes partageaient une seule limite. Les parcours contre la vraie api l'ont montré (FRONT 3) : passé la limite, l'api répond 429 et la page d'un membre échoue.

## Décision

- Une requête qui porte un cookie de session dont la signature est valide (HMAC-SHA256 du jeton par `AUTH_SECRET`, comme l'écrit Better Auth) est comptée par session : empreinte SHA-256 du jeton, jamais le jeton lui-même (`platform/http/session-cookie.ts`, `HttpThrottlerGuard`).
- Sans cookie, ou avec un cookie dont la signature est fausse, la requête est comptée par adresse, comme avant : un cookie inventé ne crée pas de nouvelle limite, et le vérifier coûte une empreinte, sans lecture en base.
- La signature seule est vérifiée, pas l'existence de la session : une session expirée mais signée garde sa propre limite le temps que l'api la refuse (401).
- Les limites de Better Auth sur les routes d'authentification (`AUTH_RATE_LIMIT_*`) ne changent pas.

## Conséquences

- Un membre a sa propre limite, qu'il appelle l'api depuis son navigateur ou à travers le serveur du web.
- Les pages publiques rendues pour un visiteur (sans session) restent comptées par l'adresse du serveur du web : question 113 (transmettre l'adresse du visiteur de façon sûre, ou exempter le serveur du web).
