# 0106. Raison précise des refus

Statut : acceptée (2026-10-09). Complète l'ADR 0096 (formulaires) et les conventions d'erreurs RFC 9457.

## Contexte

Un champ refusé ne portait que le code Zod (`invalid_format`) : le web affichait le message de la règle principale du champ, même quand la valeur respectait cette règle (un lien de visioconférence qui commence par https recevait le message sur https). Un problème métier à plusieurs causes (`EVENTS_SCHEDULE_INVALID`) avait un message unique qui énumérait les trois. Les raffinements des contrats portaient un `message` anglais, prioritaire sur la carte d'erreurs du formulaire : il atteignait l'interface.

## Décision

- Chaque erreur de champ porte, en plus de `pointer` et `code`, une `reason` quand le code en a plusieurs : le format d'un `invalid_format` (`url`, `email`, `regex`...) ou la raison déclarée par un raffinement (`https_required`, `linkedin_host`, `duplicate_values`...).
- Un raffinement des contrats déclare `params: { reason }` et jamais de `message` ; une vérification arrête les suivantes (`abort`), si bien qu'une valeur reçoit une seule raison : `httpsUrlSchema` refuse une adresse mal formée comme `invalid_format` (`url`) et une adresse http bien formée comme `https_required`.
- Une `DomainError` à plusieurs causes passe `details.reason` (identifiant court) ; le problème RFC 9457 l'expose dans `reason`.
- Le web choisit le message du plus précis au plus général : règle d'un raffinement du web, raison du champ (`web.forms.fields.<champ>.<raison>`), code du champ, raison générale (`web.forms.reasons.<raison>`), puis le code avec ses bornes ; pour un problème métier, `web.forms.problemReasons.<CODE>.<raison>` d'abord.

## Conséquences

- Tests : un message par code et par raison (`issues.spec.ts`), le même message pour une raison venue de l'api et pour le navigateur, les raisons de `toValidationIssues` et des domaines (`problem-details.spec.ts`, `events-rules.spec.ts`), et un test qui refuse un `message` dans un raffinement des contrats ou une raison sans message français (`project.spec.ts`).
- Toute nouvelle règle à plusieurs causes ajoute sa raison et son message ; jamais un message qui nomme une autre règle que celle enfreinte.
