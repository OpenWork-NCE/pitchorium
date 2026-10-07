# Délivrabilité des emails

Emails transactionnels (identity, organizations, payments) et emails de notification (notifications) partent par Resend en production (`MAIL_TRANSPORT=resend`), par Mailpit en local. Décision : ADR 0062.

## Désinscription en un clic (RFC 8058)

- Tout email non transactionnel (notification, digest, copie des messages non lus) porte :
  - `List-Unsubscribe: <https://<API_PUBLIC_URL>/v1/notifications/unsubscribe?token=...>`
  - `List-Unsubscribe-Post: List-Unsubscribe=One-Click`
- Le client de messagerie envoie un `POST` sans session à cette URL ; le jeton (HMAC SHA-256 de l'identifiant du membre et de la portée, clé `EMAIL_LINK_SECRET`) suffit. Portée : l'email d'un type de notification, ou le digest.
- Le pied de l'email renvoie vers la page de l'application web `<WEB_APP_URL>/notifications/unsubscribe?token=...`, qui appelle la même route.
- Les emails transactionnels (sécurité, paiements, KYC, conditions, invitations à jeton) n'ont pas de lien de désinscription : ils ne sont pas désactivables.

## Rebonds et plaintes

```mermaid
sequenceDiagram
  participant R as Resend
  participant A as api (webhook brut)
  participant DB as PostgreSQL
  participant M as Mailer
  R->>A: POST /v1/notifications/webhooks/resend (svix-id, svix-timestamp, svix-signature)
  A->>A: signature Svix sur le corps brut, tolérance 5 min
  A->>DB: inbox (svix-id) ; suppression de l'adresse ; notifications.email.bounced|complained.v1
  A-->>R: 200
  M->>DB: avant chaque email : adresses supprimées ?
  M-->>M: destinataire supprimé laissé de côté
```

- `email.bounced` (rebond permanent ; un rebond `Transient` est ignoré) et `email.complained` suppriment l'adresse (`notifications.suppressions`) ; les autres événements sont acquittés et ignorés.
- Le mailer (`platform/mailer`, `SuppressingMailer`) consulte la liste avant chaque envoi, transactionnel compris : une adresse qui rebondit définitivement ne reçoit plus rien. La levée d'une suppression (adresse corrigée) n'est pas encore prévue (`docs/open-questions.md`).
- Sans `RESEND_WEBHOOK_SECRET`, le webhook refuse tout appel.

## Configuration du domaine d'envoi

À faire sur le domaine de `MAIL_FROM` (domaine non choisi, `docs/open-questions.md`) :

1. SPF : un enregistrement TXT du sous-domaine d'envoi de Resend, `v=spf1 include:amazonses.com ~all` (valeur exacte donnée par Resend à l'ajout du domaine).
2. DKIM : les enregistrements `resend._domainkey` (CNAME ou TXT) fournis par Resend ; vérifier le domaine dans le tableau de bord avant tout envoi.
3. DMARC : `_dmarc.<domaine>` en TXT, d'abord `v=DMARC1; p=none; rua=mailto:<adresse de rapports>`, puis `p=quarantine` et `p=reject` une fois les rapports propres ; alignement SPF et DKIM sur le domaine de `MAIL_FROM`.
4. Webhook Resend : endpoint `<API_PUBLIC_URL>/v1/notifications/webhooks/resend`, événements `email.bounced` et `email.complained`, secret de signature dans `RESEND_WEBHOOK_SECRET`.
5. `EMAIL_LINK_SECRET` : secret aléatoire de 32 caractères au moins, propre à chaque environnement ; le changer invalide les liens de désinscription déjà envoyés.

Les gros volumes (digests, diffusion à de nombreux abonnés) devront respecter les limites d'envoi du compte Resend retenu.
