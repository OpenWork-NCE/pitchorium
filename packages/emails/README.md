# @pitchorium/emails

Templates d'emails React Email, rendus en HTML et en texte brut. Les textes viennent des catalogues `@pitchorium/i18n` (namespace `emails`) ; aucun texte n'est écrit en dur dans un template.

- `src/components/layout.tsx` : mise en page commune, couleurs neutres (`src/theme.ts`).
- `src/templates/` : un fichier par email, exporté par défaut avec des `PreviewProps` pour l'aperçu : vérification d'email, lien magique, réinitialisation du mot de passe, nouvelle connexion, changement de méthode de connexion, email de test, et `organization-notice.tsx` pour les emails transactionnels d'organisation (invitation, changement de rôle, transfert de propriété, demande, décision et retrait de vérification ; `kind` choisit le texte), et `contribution-confirmation.tsx` pour la confirmation d'une contribution payée (montant, commission, contrepartie, référence), qui précise que ce n'est pas un reçu fiscal (§9.3, §9.5) ; `notification.tsx` (une notification envoyée aussitôt, texte du namespace `notifications`), `notification-digest.tsx` (résumé quotidien ou hebdomadaire) et `unread-messages.tsx` (copie des messages non lus d'une conversation, §10.4). Le gabarit commun affiche un lien de désinscription en un clic quand `unsubscribeUrl` est fourni (emails non transactionnels, ADR 0062).
- `src/components/blocks.tsx` : titre, paragraphe, note et bouton d'action suivi de l'URL en clair.
- `src/index.ts` : une fonction `render<Nom>Email(props)` par template, qui renvoie `{ subject, html, text }`.

`pnpm --filter @pitchorium/emails preview` lance l'aperçu sur http://localhost:3030.
