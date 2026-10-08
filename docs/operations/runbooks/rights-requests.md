# Demande de droits RGPD

Délai légal de réponse : un mois (article 12), prolongeable de deux mois avec information du demandeur.

1. Suivre : `GET /v1/admin/privacy/requests` (état, échéance, retard, blocage ou résidus).
2. Export : construit par le worker, lien valable 72 heures ; un export en échec se redemande (pas de limite après un échec).
3. Suppression bloquée (`PRIVACY_CAMPAIGN_IN_PROGRESS`, `PRIVACY_SOLE_OWNER`) : le membre est informé par le code ; elle est retentée automatiquement une fois la règle levée.
4. Suppression en échec (`failed`, colonnes de résidus listées, alerte `pitchorium.privacy.erasure.residue`) : identifier le module propriétaire de la colonne, corriger son effaceur, déployer, puis remettre la demande en `running` pour la reprendre (l'exécution est idempotente) :
   `update privacy.erasures set status = 'running' where id = '<id>';` (seule écriture manuelle admise, tracée dans le fil d'incident).
5. Demande reçue hors application (email, courrier) : vérifier l'identité, puis la créer depuis le compte du membre ou, à défaut, documenter l'action manuelle.
6. Les copies hors base (sauvegardes, CDN, prestataires) suivent `docs/compliance/retention.md`.
