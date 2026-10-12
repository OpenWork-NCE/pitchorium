# 0165. Signalement et appel

Statut : acceptée (2026-10-12).

## Contexte

Le cahier des charges (§13) demande de pouvoir signaler tout contenu, de motiver chaque décision de modération et de permettre de la contester ; le règlement européen sur les services numériques ajoute le signalement sans compte d'un contenu illégal et l'exposé des motifs. Les règles (motifs, doublons, file, décisions, appel tranché par une autre personne) sont dans le module trust de l'api ; les outils des modérateurs ne sont pas livrés dans le web.

## Décision

- Un seul dialogue de signalement (`features/trust`, `ReportDialog`) pour toutes les cibles (profil, organisation, publication, commentaire, projet, actualité, événement, mission, message, image). Il est monté par la coquille membre (`ReportHost`) et chargé à la première ouverture ; une surface n'appelle que `useReport()` de `lib/actions/report.ts`. Les motifs viennent de `GET /v1/reports/reasons` (libellés dans `reference.reportReasons`).
- Un message est signalé avec les trois messages qui le précèdent seulement, et le dialogue le dit.
- Le visiteur signale par `/report` (`NoticeForm`) : adresse de la page publique, explication, contact facultatif, déclaration de bonne foi, Turnstile quand l'api l'exige ; l'accusé donne la date et la référence. Le pied de page et la page juridique y mènent.
- `/settings/moderation` montre au membre les décisions qui le concernent avec leur exposé des motifs (motif, faits, fondement et sa référence, détection automatique ou non), la suspension en cours, l'appel (formulaire, puis l'appel envoyé et la décision finale avec ses motifs) et ses propres signalements avec leur issue. Les notifications de modération y mènent par une ancre de décision.
- Le bouton « Faire appel » dépend seulement de `appealableUntil` et de l'absence d'appel, donnés par l'api.

## Conséquences

- Une nouvelle surface signalable ajoute une entrée de menu qui appelle `useReport()` ; ni le dialogue ni les motifs ne sont dupliqués.
- Le parcours signalement, décision, appel tranché par un autre modérateur est vérifié contre l'api (`e2e-live/trust.spec.ts`, `@critical`), les décisions passant par l'api d'administration.
