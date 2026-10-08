# 0064. Livraison des notifications par lots

Statut : acceptée (2026-10-08). Complète l'ADR 0059.

## Contexte

La création des notifications d'un événement diffusé aux abonnés d'une cible se faisait déjà par lots (ADR 0059), mais chaque notification créée enregistrait son propre événement `notifications.notification.created.v1`, livré par une tâche (push, compteurs, email), et chaque email envoyé un `notifications.email.sent.v1`. Pour une actualité de projet suivie par 5 000 membres qui ont tous demandé l'email : 10 012 tâches et 166 s jusqu'au dernier email (test `notifications-fanout-volume.spec.ts`, poste de développement, Mailpit).

## Décision

- Une tâche traite un lot de destinataires de bout en bout : la tâche `fanout` crée, dans une transaction, les livraisons (source, destinataire), les notifications et les regroupements du lot par insertions groupées, et enregistre un seul `notifications.batch.created.v1` (identifiants des notifications créées et regroupées). Son handler met en file une tâche `deliver` (identifiant dérivé de l'événement) qui, hors de toute transaction, pousse chaque notification et les compteurs, puis envoie les emails immédiats.
- Emails regroupés : utilisateurs lus en une requête (`IdentityFacade.findUsers`), liste de suppression consultée une fois par groupe, envoi par `Mailer.sendMany` (point d'accès batch de Resend, 100 emails par appel ; connexions SMTP mutualisées en local), un `notifications.email.sent.v2` par groupe de 100 (destinataires du groupe).
- Taille des lots : `NOTIFICATIONS_FANOUT_BATCH_SIZE` (500 par défaut, provisoire), qui vaut aussi pour la livraison.
- Idempotence : la création reste idempotente par couple (événement, destinataire) grâce à la table `deliveries`, et un lot est créé en entier ou pas du tout. Chaque groupe d'emails est marqué envoyé (`emailed_at`) dès son envoi : une tâche `deliver` reprise après un échec ne renvoie que les emails non marqués (au plus le groupe en cours au moment de l'échec) ; le push rejoué est sans effet visible.
- Mesure après (même test) : 82 tâches et 50 s pour 5 000 destinataires, plafond de 100 tâches vérifié en CI. Le temps restant est surtout le rendu des 5 000 emails et le calcul des compteurs de chaque destinataire.

## Conséquences

- `notifications.notification.created.v1` et `notifications.email.sent.v1` disparaissent (internes, sans consommateur) au profit de `notifications.batch.created.v1` et `notifications.email.sent.v2`.
- Un email non envoyé pour une adresse supprimée reste marqué envoyé, comme avant.
- Les envois en nombre restent soumis aux limites du compte Resend retenu (`docs/architecture/email-deliverability.md`).
