# 0170. États datés des données de démonstration relatifs à l'exécution

Statut : acceptée (2026-10-12).

## Contexte

`pnpm db:seed:dev` écrit ses données en dates relatives à son exécution, puis ne réécrit rien d'existant (idempotence, ADR 0035). Quelques états n'ont de sens qu'à une distance de la date du jour : une suspension de quatorze jours, une suppression de compte dans son délai de grâce de trente jours et son rappel, un export valable soixante-douze heures, des campagnes en financement avec leurs jours restants, des événements à venir, la date à laquelle une mission est souhaitée, des invitations et des demandes de connexion qui expirent. Exécuté de nouveau des semaines plus tard, le seed laissait ces états échus, et le worker les avait menés à leur fin (suspension levée, campagnes clôturées, compte supprimé).

## Décision

- Au début de chaque exécution, `shiftDatedStates` (`scripts/dev-seed/seed-dev-dates.ts`) replace chacun de ces états à sa distance prévue de la date de l'exécution : la suspension de Rodrigue Mbemba commencée six heures avant, la suppression de Moussa Diarra demandée à l'instant (rappel remis à venir), l'export d'Aïssatou Ba demandé à l'instant, chaque campagne publiée `publishedDaysAgo` jours avant, chaque événement `inDays` jours après, la mission souhaitée 64 jours après, les invitations et demandes en attente envoyées la veille. Toutes les dates liées d'un état sont décalées ensemble (début, fin, décision, échéance de l'appel), pour garder leur cohérence.
- Un état que le worker a mené à son terme alors qu'il devrait encore courir est rouvert : campagne clôturée qui reprend son statut de financement, événement à venir terminé qui redevient publié, suspension échue qui reprend, invitation ou demande expirée qui redevient en attente. Les services du seed ferment ensuite, comme le worker, ce qui doit l'être à la nouvelle date (campagnes et événements passés).
- Après les services, `requestDatedStates` redemande par le module privacy la suppression de Moussa Diarra et l'export d'Aïssatou Ba quand le worker les a exécutés (compte supprimé puis recréé, archive expirée).
- Rien n'est inséré par le décalage : les autres lignes restent telles que la première exécution les a écrites. Un état déjà à moins d'une minute de sa place n'est pas touché ; la première exécution ne trouve rien à décaler.
- Le décalage écrit directement dans les tables des modules, comme le reste du script de développement qui n'est pas soumis aux frontières ; les nouvelles données passent toujours par les services (ADR 0035).

## Conséquences

- Les comptes de démonstration montrent les mêmes états, quel que soit le délai depuis la création de la base. Les dates d'historique (publications, contributions, messages) gardent leur date d'origine.
- Test d'intégration (`dev-seed.spec.ts`) : une exécution quarante jours plus tard trouve la suspension en cours, la suppression dans son délai sans rappel envoyé, les campagnes en financement ouvertes et les événements à venir devant elle, sans aucune ligne ajoutée ; une seconde exécution à la même date ne déplace rien.
- Un état ajouté au seed qui dépend de la date du jour s'ajoute à `seed-dev-dates.ts`.
