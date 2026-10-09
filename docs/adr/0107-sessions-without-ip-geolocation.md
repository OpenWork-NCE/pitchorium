# 0107. Sessions sans géolocalisation de l'adresse IP

Statut : acceptée (2026-10-09). Ferme la question ouverte 106.

## Contexte

La liste des sessions des paramètres de sécurité (ADR 0104) aide un membre à reconnaître un appareil qu'il ne connaît pas. Un lieu approximatif (« Dakar, Sénégal ») le ferait aussi, mais suppose de géolocaliser l'adresse IP de chaque session : un prestataire qui reçoit ces adresses, ou une base locale à tenir à jour, une précision trompeuse (opérateurs mobiles, VPN, relais d'entreprise) et un traitement de plus à déclarer au registre (RGPD, article 30), pour une donnée de localisation que le membre n'a pas fournie.

## Décision

- Aucune géolocalisation de l'adresse IP, ni à la connexion ni à l'affichage, au nom de la protection des données dès la conception (RGPD, article 25).
- Chaque session se décrit par ce que son agent utilisateur dit de lui-même, lu dans le navigateur (`describeUserAgent`, `features/identity/lib/user-agent.ts`) : le type d'appareil (ordinateur, téléphone, tablette, avec son icône), le navigateur et le système, puis la dernière activité et la date d'ouverture. « Cet appareil » marque la session courante.
- L'adresse IP reste ce qu'elle est aujourd'hui : enregistrée par Better Auth avec la session et utilisée par les limites de fréquence ; elle n'est ni affichée ni transmise à un tiers.

## Conséquences

- Aucun prestataire ni base de géolocalisation à choisir, à financer ou à déclarer.
- Un membre reconnaît une session à son appareil et à son activité ; une session inconnue se ferme d'un geste, ou toutes les autres à la fois.
- Revenir sur ce choix demanderait un nouvel ADR, la mention au registre des traitements et l'information des membres.
