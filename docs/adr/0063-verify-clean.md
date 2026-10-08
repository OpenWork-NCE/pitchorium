# 0063. Vérification depuis zéro (`pnpm verify:clean`)

Statut : acceptée (2026-10-08).

## Contexte

La définition de terminé (`AGENTS.md`) s'exécutait sur le poste de développement, contre l'infrastructure locale de tous les jours : une base déjà migrée, des volumes peuplés, des fichiers non commités ou un cache de Turborepo pouvaient masquer un défaut que la CI ou un nouveau poste rencontreraient. Lancer la vérification sur des volumes vierges ne doit pas pour autant détruire les données locales (`pitchorium_*`).

## Décision

- `pnpm verify:clean` (`scripts/verify-clean.sh`) clone l'état commité (`HEAD`, ou `VERIFY_REF`) dans un répertoire temporaire, sans fichier non suivi, sans `node_modules`, sans cache de Turborepo.
- Il démarre un projet Docker Compose distinct (`COMPOSE_PROJECT_NAME`, `pitchorium-verify` par défaut, refus de `pitchorium`) sur des ports dédiés : port par défaut de chaque service plus `VERIFY_PORT_OFFSET` (20000 par défaut), par les variables `PITCHORIUM_*_PORT` de `infra/docker/compose.yaml`. Le `.env` du clone, dérivé de `.env.example`, pointe vers ces ports et un préfixe de files BullMQ propre.
- Il enchaîne `pnpm install --frozen-lockfile`, `infra:up`, `db:migrate`, `db:seed`, `db:seed:dev`, `lint`, `typecheck`, `test`, `test:integration`, `build`, `openapi:generate`, `api-client:generate`, puis les contrôles de cohérence (`format:check`, `check:box-drawing`, `i18n:check`, `db:check`) et exige un `git status` vide après génération.
- Il s'arrête au premier échec, affiche la fin du journal de l'étape, puis supprime toujours ses conteneurs, ses volumes (`down -v`) et le clone ; les journaux restent dans un répertoire temporaire indiqué à la fin. `VERIFY_KEEP=1` conserve le clone et le projet pour une inspection.

## Conséquences

- Le résultat ne dépend que du commit vérifié : un fichier oublié dans un commit, une migration non générée ou un client d'API non régénéré font échouer la vérification.
- Une exécution complète prend plusieurs minutes (démarrage de ClamAV, tests d'intégration) ; les tests d'intégration gardent leurs propres conteneurs Testcontainers.
- Les ports par défaut plus 20000 doivent être libres ; `VERIFY_PORT_OFFSET` en choisit d'autres.
