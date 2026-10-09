# 0104. Parcours d'authentification et d'onboarding du web

Statut : acceptée (2026-10-09). Applique le §7.2 du cahier des charges sur le module identity (ADR 0013 à 0021) et Turnstile (ADR 0103).

## Contexte

On rejoint Pitchorium en moins d'une minute, sans choix de rôle, puis on complète au fil de l'eau (§7.2). Le web parle à Better Auth sur une autre origine que la sienne : chaque redirection de l'api (lien d'email, fournisseur OAuth) revient vers une adresse absolue du web. Les conditions légales sont exigées par l'api pour presque toute action, y compris lire le fil.

## Décision

- Un seul point d'entrée, `/{locale}/sign-in` : boutons Google, LinkedIn, Microsoft (ceux que `GET /v1/auth-configuration` dit activés, dans cet ordre, logos officiels servis par `public/providers`), puis l'email en chemin secondaire (mot de passe ou lien magique). `/sign-up` ne demande que nom, email et mot de passe. Écrans associés : `/check-email` (renvoi après un délai visible de 60 s), `/email-verified` (succès, lien expiré ou invalide), `/forgot-password`, `/reset-password`, `/sign-in/two-factor` (TOTP ou code de secours), `/auth/error` (accès refusé, adresse non vérifiée, compte existant non liable avec le parcours « se connecter puis relier »).
- Chaque connexion aboutit à `/continue?redirectTo=` (composant serveur) : conditions à accepter d'abord (`/onboarding/terms`), puis la page demandée. Un nouveau compte (OAuth, lien magique, vérification d'email) va à `/onboarding` : conditions (obligatoires), intention (sautable), profil minimum (sautable, enregistré champ par champ, barre de force calculée par l'api), puis le fil.
- `redirectTo` n'accepte qu'un chemin de la même origine (`lib/auth/redirect.ts`) : ni schéma, ni `//`, ni barre oblique inverse, ni caractère de contrôle ; le proxy l'écrit pour l'espace membre.
- Les messages de `/v1/auth` sont traduits par code (`errors.auth.<CODE>`) et ne disent jamais si un compte existe ; une limite de fréquence affiche son délai (`X-Retry-After`, exposé par CORS).
- Paramètres : `/settings/account` (email, méthodes liées, la dernière jamais retirable, versions acceptées), `/settings/security` (mot de passe, double authentification par QR code ou clé, codes de secours à copier ou télécharger, sessions et révocation), `/settings/preferences` (langue active, fuseau, thème). Les sections des prompts suivants n'apparaissent qu'une fois livrées.
- Un modérateur ou un administrateur sans double authentification est renvoyé de `(admin)` vers `/settings/security?required=two-factor`.
- Liens vers les textes légaux : `NEXT_PUBLIC_LEGAL_TERMS_URL` et `NEXT_PUBLIC_LEGAL_PRIVACY_URL` (question 31) ; sans elles, la version seule est affichée.

## Révision du 2026-10-09

- Entrée simplifiée : les fournisseurs puis un seul « Continuer avec un email », de même poids ; l'étape email (`/sign-in/email`) envoie un lien de connexion par défaut (connexion ou inscription, même réponse pour toute adresse) et propose « Utiliser un mot de passe » (`/sign-in/password`) ; plus de liens empilés sous les boutons.
- Panneau de marque violet profond dans les deux thèmes (token `brand-panel`), un seul logo par écran (les fonds discrets du kit portent un logotype : retirés de la colonne du formulaire), pas de vide entre le formulaire et le panneau sur un téléphone.
- Photo de l'onboarding : l'avatar et un bouton « Ajouter une photo », à la place de la zone de dépôt.

## Conséquences

- L'onboarding écrit comme l'espace membre : son budget de JavaScript est celui de l'espace membre (250 kB, `check-bundles.mjs`), le reste de `(auth)` garde 220 kB ; le QR code, la recherche des pays, les champs de langue et de fuseau et le dialogue des prérequis se chargent à la demande.
- Les parcours se vérifient contre la vraie api (`e2e-live`, `playwright.live.config.ts`), en plus de l'api simulée pour l'accessibilité des écrans publics.
- Un compte sans mot de passe (OAuth seul) ne peut pas activer la double authentification : Better Auth la confirme par mot de passe (question 107).
