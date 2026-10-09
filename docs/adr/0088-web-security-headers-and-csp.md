# 0088. Sécurité du web : CSP à nonce et en-têtes

Statut : acceptée (2026-10-08).

## Contexte

Le web affiche des contenus de membres et parle à une api qui authentifie par cookie : une injection de script serait critique. Next.js applique un nonce à ses propres scripts si la CSP de la requête le porte.

## Décision

- `src/proxy.ts` crée un nonce par requête et une CSP stricte (`lib/security/csp.ts`) : scripts par nonce et `strict-dynamic` (sans `unsafe-eval` en production), styles par nonce plus les empreintes des feuilles que `sonner` et `vaul` insèrent au chargement de leur module (recalculées par un test depuis la version installée), le nonce étant donné au verrouillage du défilement des dialogues modaux (`get-nonce`, `StyleNonce`), attributs `style` autorisés (React, Radix, `next/image` ne peuvent pas les signer), `connect-src` limité à l'api (HTTPS et WebSocket), au point d'envoi du stockage objet (`NEXT_PUBLIC_UPLOAD_URL`, URL présignées des fichiers envoyés par le navigateur), à Sentry et à Vercel s'ils sont configurés, images et médias de l'api et du CDN, cadres YouTube sans cookie et Vimeo, `form-action` vers Stripe et Flutterwave, `frame-ancestors 'none'`, `upgrade-insecure-requests` en HTTPS, rapport des violations à Sentry si un DSN existe.
- En-têtes de toutes les réponses (`next.config.ts`) : `X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy: strict-origin-when-cross-origin`, `Permissions-Policy` restrictive, `Cross-Origin-Opener-Policy`, HSTS en HTTPS.
- Zod est configuré sans compilation (`jitless`) : sa détection de `new Function` déclencherait une violation.
- Le proxy ne vérifie que la présence d'un cookie de session dans l'espace membre et l'administration ; la session et le rôle sont vérifiés par l'api à chaque appel.

## Conséquences

- Toutes les pages sont rendues à la requête (le nonce l'impose).
- Une bibliothèque qui injecte un script ou un style sans nonce doit être évitée ou autorisée par empreinte testée ; le test de bout en bout « CSP sans violation » le détecte.
- Les origines des fichiers privés (URL présignées du stockage) et des prestataires de paiement seront ajoutées avec leurs parcours.
