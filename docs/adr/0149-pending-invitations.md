# 0149. Invitations en attente dans l'application

Statut : acceptée (2026-10-11).

## Contexte

Une invitation à une organisation se réglait seulement par le lien de son email (jeton à usage unique, ADR 0025) : un membre qui avait perdu l'email, ou qui ouvrait la notification `organization_invitation`, ne pouvait pas répondre depuis l'application (question 129). Les invitations d'équipe de projet se règlent déjà par leur identifiant, avec le consentement d'affichage public (ADR 0131).

## Décision

- `GET /v1/me/organization-invitations` liste les invitations ouvertes (en attente, non échues, organisation vivante) adressées à l'email vérifié du membre : organisation (nom, slug, logo public, badge), rôle, échéance, jamais l'adresse. La liste est vide tant que l'email n'est pas vérifié.
- `POST /v1/me/organization-invitations/{invitationId}/accept` et `/decline` répondent sans le jeton, aux mêmes conditions que la réponse par le jeton (email vérifié, adresse invitée, verrou des membres). Une invitation adressée à une autre adresse répond `ORGANIZATIONS_INVITATION_INVALID` (410), comme une invitation fermée : un identifiant ne révèle rien.
- Le web réunit les invitations d'organisation et d'équipe de projet dans une section « Invitations » de la page Réseau (`/network/invitations`), atteinte depuis le menu du compte. La notification `organization_invitation` y mène ; la notification `project_team_invitation` ouvre un dialogue d'acceptation qui porte le consentement d'affichage public de l'équipe.

## Conséquences

- Le lien de l'email reste valable : les deux chemins ferment la même invitation, le second appel répond 410.
- Le compteur des invitations d'organisation de `GET /v1/me/counters` compte les mêmes invitations que la liste.
