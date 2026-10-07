# 0062. Délivrabilité des emails

Statut : acceptée (2026-10-08).

## Contexte

Les notifications multiplient les emails. Gmail et Yahoo exigent depuis 2024 une désinscription en un clic pour les envois en nombre ; écrire à une adresse qui rebondit ou qui se plaint dégrade la réputation du domaine d'envoi.

## Décision

- Emails non transactionnels : en-têtes `List-Unsubscribe` et `List-Unsubscribe-Post` (RFC 8058) vers `POST /v1/notifications/unsubscribe?token=`, sans session, et lien vers la page de l'application web dans le pied de l'email ; jeton HMAC SHA-256 (`EMAIL_LINK_SECRET`, valeur de développement refusée en production) portant le membre et la portée (type de notification ou digest).
- Webhook Resend signé par Svix (`RESEND_WEBHOOK_SECRET`), lu sur le corps brut, dédupliqué par l'inbox : rebond permanent et plainte suppriment l'adresse.
- Le mailer de la plateforme consulte au démarrage les sources de suppression enregistrées (port `MailSuppressionSource`) et n'écrit jamais à une adresse supprimée, emails transactionnels compris.
- SPF, DKIM et DMARC du domaine d'envoi documentés (`docs/architecture/email-deliverability.md`).

## Conséquences

- Une adresse supprimée ne reçoit plus d'email de vérification ou de réinitialisation : la levée d'une suppression reste à définir (`docs/open-questions.md`).
