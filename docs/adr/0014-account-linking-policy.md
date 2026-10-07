# 0014. Politique de liaison de comptes

Statut : acceptée (2026-10-07)

## Contexte

Un membre peut se connecter avec plusieurs méthodes. Lier automatiquement un compte OAuth à un compte existant de même email est confortable mais permet une prise de compte si le fournisseur atteste un email que l'utilisateur ne possède pas. Entra ID (Microsoft) laisse un tenant déclarer un email arbitraire (classe « nOAuth »).

## Décision

- Liaison implicite (à la connexion OAuth) seulement si le fournisseur atteste l'email vérifié (`email_verified` de Google ou de LinkedIn) et si l'email du compte local est lui-même vérifié (`requireLocalEmailVerified`, contre la pré-création d'un compte par un tiers).
- Aucun fournisseur n'est déclaré de confiance par son nom (`trustedProviders` vide).
- Microsoft : l'email n'est jamais considéré comme vérifié (`mapProfileToUser`), donc jamais de liaison implicite, ni d'email vérifié à la création. Seule exception : un flux de liaison explicite lancé par un membre connecté (l'état OAuth porte alors la demande de liaison).
- Liaison et déliaison manuelles depuis le compte connecté (`link-social`, `unlink-account`), adresse différente autorisée. La dernière méthode de connexion ne peut pas être retirée.
- Préremplissage OAuth limité au nom et à la photo (URL) ; pas de photo Microsoft (Graph la renvoie en data URL).

## Conséquences

- Un membre qui s'est inscrit par email sans vérifier son adresse doit la vérifier avant que Google ou LinkedIn soient liés automatiquement ; sinon la connexion OAuth échoue avec `account_not_linked` et le frontend l'invite à se connecter puis à lier le fournisseur.
- Chaque liaison, déliaison ou changement de mot de passe émet un événement et un email d'alerte.
