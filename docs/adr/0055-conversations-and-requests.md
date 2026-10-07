# 0055. Modèle des conversations et des demandes de message

Statut : acceptée (2026-10-08).

## Contexte

La messagerie (§10.4) relie des membres connectés, mais aussi des membres hors réseau : un réseau d'affaires doit permettre un premier contact sans ouvrir la porte au démarchage. Le §7.2 exige un email vérifié pour la « messagerie hors réseau proche ». Les introductions à trois (§14, V2) créent des conversations à plusieurs.

## Décision

- Une conversation `direct` par paire de membres (`direct_key` unique), créée par le premier message ; une conversation `group` de trois membres, créée seulement par une introduction conclue (ADR 0058).
- Participants génériques (`participant_type`, `participant_id`), `member` seul aujourd'hui, pour accueillir d'autres participants (organisation) sans migration ; l'état de lecture, l'archivage, la sourdine, le marqué non lu et le départ sont propres à chaque participant.
- Entre connectés, l'écriture est libre. Hors réseau : email vérifié, puis préférence du destinataire (`connections_only`, `connections_and_second_degree` par défaut, `verified_members`), et le premier message crée une demande (`status = request`) rangée dans la boîte « demandes » du destinataire. L'expéditeur n'écrit plus avant l'acceptation ; le refus (`declined`) est silencieux pour lui ; répondre vaut acceptation ; une connexion ultérieure lève la demande.
- Anti-abus configurable : nombre de premières demandes par expéditeur sur 24 heures glissantes.
- Un blocage interdit toute conversation et masque, des deux côtés, celles qui existent (même réponse que pour une conversation inconnue).

## Conséquences

- Les règles sont des fonctions pures (`domain/conversation.ts`) couvertes par des tests unitaires.
- La valeur par défaut de la préférence, la portée de `verified_members` (email vérifié, seule vérification d'une personne aujourd'hui) et le plafond des demandes restent à valider (`docs/open-questions.md`).
