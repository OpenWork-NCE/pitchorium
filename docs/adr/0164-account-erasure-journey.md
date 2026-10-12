# 0164. Parcours de suppression du compte

Statut : acceptée (2026-10-12).

## Contexte

Le RGPD (cahier des charges §13) donne au membre le droit d'obtenir ses données et de faire supprimer son compte. L'api applique les règles : bloqueurs (campagne en financement, seul propriétaire d'une organisation qui a d'autres membres), délai de grâce annulable (`PRIVACY_ERASURE_GRACE_DAYS`), rappel, connexion récente exigée, exécution par le worker. L'interface doit rendre ces règles lisibles sans les recalculer, et la suppression ne doit jamais partir sur un clic involontaire.

## Décision

- Une page `/settings/personal-data` (`features/privacy`) réunit l'export et la suppression. Elle affiche ce que l'api donne : `erasureBlockers` avec la ressource en cause et le lien vers l'action qui lève le blocage, `nextExportAt`, `erasure` et son `reminderAt`. Aucune règle n'est déduite dans le navigateur.
- Ce que devient chaque donnée (supprimée ou gardée sous pseudonyme) est dit avant la confirmation ; la durée de conservation légale reste « en cours de validation juridique » tant que la question ouverte n'est pas tranchée.
- La confirmation est un `AlertDialog` dont le bouton reste inactif tant que la phrase « supprimer mon compte » (catalogue `web.privacy.erasure.phrase`) n'est pas tapée.
- `ACCESS_REAUTHENTICATION_REQUIRED` affiche un encadré « Reconnectez-vous pour confirmer » ; le lien passe par `/sign-in?redirectTo=…/settings/personal-data?erase=1`, et le retour rouvre la confirmation.
- Pendant le délai de grâce : date, rappel, bouton d'annulation. Une fois la date passée, la page relit l'aperçu à intervalle court ; la première réponse 401 (le compte n'existe plus) déconnecte l'appareil (`useSignOut`) et mène à `/account-deleted`, une page neutre sans session, sans lien vers l'espace membre.
- L'archive se télécharge par le lien court de l'api (`download-url`), jamais gardé dans le navigateur ; la page relit l'aperçu quand une notification arrive (archive prête).

## Conséquences

- Un nouveau bloqueur côté api n'a besoin que de son texte et de son action dans `web.privacy.erasure.blockers` et `blockerActions`.
- Le parcours réel (bloqué, programmé, annulé, reprogrammé, exécuté) est vérifié contre l'api par `e2e-live/trust.spec.ts`, qui avance la fin de la campagne et du délai de grâce dans la base (`e2e-live/database.ts`) ; le worker fait le reste.
