# 0171. Une horloge pour l'api simulée, le serveur des pages et le navigateur

Statut : acceptée (2026-10-12).

## Contexte

L'api simulée des parcours et des captures de revue (`e2e/support/stub-*.mjs`) datait ses données d'une date fixe (le 10 octobre 2026, pour des captures identiques d'un run à l'autre), mais le serveur des pages et le navigateur lisaient l'heure réelle. Pour qu'un délai d'appel, une suppression programmée ou un paiement en attente restent « à venir » face à l'heure réelle, ces dates avaient été poussées à dix ans : les captures affichaient « jusqu'au 7 octobre 2036 ». D'autres modules de l'api simulée dataient leurs données de l'heure réelle (publications, messages) : deux horloges dans la même page.

## Décision

- Une seule horloge (`e2e/support/stub-clock.mjs`) : elle part de la date fixe `STUB_EPOCH` (2026-10-10T09:00Z) à un instant réel commun du run (`STUB_CLOCK_START`, posé une fois par la configuration de Playwright et hérité par ses workers et ses serveurs), puis avance avec le temps réel. Chaque module de l'api simulée lit `stubNow()` et `stubIso()`, jamais `Date.now()`.
- Le serveur des pages (`next start` du build `.next-e2e`) charge `stub-clock.cjs` (`NODE_OPTIONS=--require`) : son `Date` est un proxy du vrai, qui ne change que `Date.now()` et `new Date()` sans argument ; toute date reste une instance de `Date`.
- Le navigateur part du même instant : chaque contexte (celui du test et ceux de `browser.newContext()`) reçoit `clock.setSystemTime(stubNow())` (fixture `stubClock`, `e2e/support/clock.ts`, de la suite simulée et des captures de revue) ; les minuteries restent réelles.
- Les dates de l'api simulée redeviennent vraisemblables : délai d'appel de 183 jours après la décision, suppression dans son délai de grâce de trente jours, paiement en attente valable un jour.
- Lighthouse sert le même build sans cette horloge commune (`serve.mjs` sans `STUB_CLOCK_START`) : il ne mesure pas de dates.

## Conséquences

- Les captures de revue et de référence montrent des dates cohérentes, identiques d'un run à l'autre ; un rendu du serveur et l'hydratation lisent la même heure.
- Une donnée de l'api simulée se date par `stubIso(décalage)` ou par rapport à `STUB_EPOCH`, jamais par l'heure réelle.
- Les parcours contre la vraie api gardent l'heure réelle.
