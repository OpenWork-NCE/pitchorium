# Rotation des secrets

Secrets (`docs/operations/environments.md`, colonne Production « secret ») : `AUTH_SECRET`, `EMAIL_LINK_SECRET`, accès PostgreSQL et Redis, clés S3/R2, `RESEND_API_KEY`, `RESEND_WEBHOOK_SECRET`, clés et secrets de webhook Stripe et Flutterwave, `DEEPL_API_KEY`, `GOOGLE_TRANSLATE_API_KEY`, identifiants OAuth, `CLOUDFLARE_API_TOKEN`, `SENTRY_DSN`.

1. Créer la nouvelle valeur chez le fournisseur (sans révoquer l'ancienne quand il permet deux clés actives).
2. La placer dans le gestionnaire de secrets, redéployer l'api et le worker.
3. Vérifier (`/v1/health/ready`, un parcours fonctionnel du service concerné), puis révoquer l'ancienne valeur.

Cas particuliers :

- `AUTH_SECRET` : sa rotation invalide toutes les sessions (reconnexion de tous les membres) ; à planifier.
- `EMAIL_LINK_SECRET` : les liens de désinscription déjà envoyés cessent de fonctionner.
- Secrets de webhook : changer côté application et côté prestataire dans la même fenêtre (`webhooks.md`).
- Fuite suspectée : rotation immédiate, revue du journal d'audit, procédure `incident.md`.
