# 0023. Antivirus ClamAV

Statut : acceptée (2026-10-07)

## Contexte

Les fichiers envoyés (PDF de pitch, pièces jointes, justificatifs) sont relus par d'autres membres et par l'équipe de modération. Le cahier des charges impose la confiance et la sécurité (§13) sans préciser d'outil.

## Décision

- Port `MalwareScanner` dans le module media ; adaptateur ClamAV (`clamav/clamav:1.5.4`) interrogé par le protocole clamd `INSTREAM` sur TCP (`CLAMAV_HOST`, `CLAMAV_PORT`, `CLAMAV_TIMEOUT_MS`), implémenté directement avec `node:net` plutôt que par une bibliothèque tierce peu maintenue.
- Chaque fichier est analysé avant même la détection de son type : un fichier infecté est rejeté avec `malware_detected`, quel que soit son type.
- Un ClamAV indisponible fait échouer le job, qui est réessayé (8 tentatives à délai exponentiel) ; au dernier essai, le fichier est rejeté (`processing_failed`). Un fichier n'est jamais publié sans analyse.
- Adaptateur de test : `test/integration/support/fake-malware-scanner.ts` (signature EICAR seulement), pour les tests qui ne portent pas sur l'antivirus ; les tests du module media utilisent un vrai ClamAV avec le fichier de test EICAR.

## Conséquences

- Un service de plus à exploiter (`infra/docker/compose.yaml` en local) : environ 1,5 Go de mémoire, une à deux minutes de chargement des signatures au démarrage, mises à jour par freshclam.
- L'hébergeur de production doit fournir ce conteneur à côté du worker (question ouverte sur l'hébergement).
