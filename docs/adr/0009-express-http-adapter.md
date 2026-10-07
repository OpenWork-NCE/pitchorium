# 0009. Adaptateur HTTP Express

Statut : acceptée (2026-10-07)

## Contexte

NestJS propose Express et Fastify. Les besoins (Helmet, Socket.IO, Swagger UI, instrumentation OpenTelemetry, Sentry, rate limiting) sont tous couverts par l'écosystème Express.

## Décision

`@nestjs/platform-express` (Express 5).

## Conséquences

- Compatibilité maximale des middlewares et de l'instrumentation.
- Débit brut inférieur à Fastify, sans impact attendu à l'échelle visée ; le changement resterait localisé dans `platform/http` et les points d'entrée.
