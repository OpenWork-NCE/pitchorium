# 0056. Fiabilité du temps réel

Statut : acceptée (2026-10-08).

## Contexte

Les messages et les notifications sont poussés par Socket.IO à des membres connectés sur plusieurs appareils, à travers plusieurs instances de l'api et depuis le worker. Une connexion mobile se coupe souvent ; un client réessaie un envoi dont l'accusé s'est perdu.

## Décision

- Persistance avant diffusion : un message est écrit, avec son événement (outbox), dans une transaction ; la diffusion n'a lieu qu'après la validation. Une diffusion perdue n'est jamais une perte de données.
- Numéro de séquence serveur par conversation, attribué sous le verrou de la ligne de la conversation : ordre total, sans trou.
- Identifiant client (`clientMessageId`) unique par expéditeur : un envoi rejoué, par HTTP ou par socket, rend le message enregistré ; le même identifiant avec un autre contenu est refusé.
- Synchronisation : après une reconnexion, le client envoie sa dernière séquence connue (`messaging:sync`, ou `GET .../messages?afterSequence=`) et reçoit les messages manquants dans l'ordre.
- Multi-appareils : chaque socket authentifiée rejoint la room `user:<id>` ; l'api et le worker publient vers ces rooms par le canal Redis de l'adaptateur Socket.IO (`@socket.io/redis-emitter`).
- Indicateur de saisie relayé sans persistance, limité à un par socket et par conversation toutes les 2 secondes ; accusés de lecture diffusés à tous les participants.
- Les charges utiles sont validées par les schémas Zod de `packages/contracts` (`realtime.ts`) ; une erreur répond par un code stable dans l'accusé.

## Conséquences

- Le client est la source de l'ordre d'affichage par la séquence, jamais par l'heure de réception.
- Protocole décrit dans `docs/architecture/realtime.md`.
