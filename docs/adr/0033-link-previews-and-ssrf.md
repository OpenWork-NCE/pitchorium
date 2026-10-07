# 0033. Aperçus de liens et protection anti-SSRF

Statut : acceptée (2026-10-07)

## Contexte

Une publication peut contenir un lien avec aperçu (§10.3). Construire l'aperçu oblige le serveur à télécharger une URL choisie par un membre : sans protection, il devient un relais vers le réseau interne (SSRF : métadonnées du cloud, Redis, PostgreSQL, interfaces d'administration). Charger l'image de l'aperçu depuis le site tiers exposerait en outre l'adresse IP des lecteurs à ce site.

## Décision

- Client HTTP sortant unique (`platform/outbound/SafeHttpClient`) :
  - schémas `http` et `https` seulement, ports par défaut, aucun identifiant dans l'URL ;
  - résolution DNS une fois par saut ; toutes les adresses de la réponse doivent être publiques (refus du bouclage, des plages privées, du CGNAT, du link-local dont 169.254.169.254, de la documentation, du multicast, des plages réservées, des adresses IPv6 locales et de transition) ; la connexion se fait vers l'adresse vérifiée par une fonction `lookup` qui la renvoie telle quelle : une seconde réponse DNS (rebinding) n'est jamais utilisée ;
  - redirections suivies à la main, chaque cible vérifiée de nouveau, 3 au plus ;
  - délai global et taille maximale du corps ; type de contenu attendu vérifié avant la lecture du corps.
- Le module content lit la page dans un job du worker (hors transaction, ADR 0019), extrait les balises Open Graph (`og:title`, `og:description`, `og:site_name`, `og:image`, replis `<title>` et `description`) par un analyseur limité à l'en-tête, sans exécution de script.
- L'image est importée par le module media (usage `link_preview`) avec le même client : antivirus, type réel, ré-encodage sans métadonnées, variantes. Les lecteurs chargent l'image depuis la plateforme (CDN ou URL présignée), jamais depuis le site tiers.
- Un refus ou un échec donne un aperçu `failed` : le lien reste affiché, sans aperçu, sans nouvel essai.

## Conséquences

- Un site qui ne répond qu'en IPv6 de transition, sur un port non standard ou par plus de 3 redirections n'a pas d'aperçu.
- Le même client sert à tout futur téléchargement d'une URL fournie par un membre ; les photos des fournisseurs OAuth gardent leur liste fermée d'hôtes.
- Tests unitaires : plages refusées, rebinding (une seule résolution, connexion à l'adresse vérifiée), redirection vers une adresse privée ou un nom privé, boucle de redirections, taille, type et délai.
