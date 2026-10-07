# @pitchorium/emails

Templates d'emails React Email, rendus en HTML et en texte brut. Les textes viennent des catalogues `@pitchorium/i18n` (namespace `emails`) ; aucun texte n'est écrit en dur dans un template.

- `src/components/layout.tsx` : mise en page commune, couleurs neutres (`src/theme.ts`).
- `src/templates/` : un fichier par email, exporté par défaut avec des `PreviewProps` pour l'aperçu.
- `src/index.ts` : une fonction `render<Nom>Email(props)` par template, qui renvoie `{ subject, html, text }`.

`pnpm --filter @pitchorium/emails preview` lance l'aperçu sur http://localhost:3030.
