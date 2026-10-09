import { GenericContainer, type StartedTestContainer, Wait } from 'testcontainers';

const CLAMAV_IMAGE = 'clamav/clamav:1.5.4';

/**
 * ClamAV with the signatures shipped in the image (no update at startup). Loading them takes
 * up to a minute: only the tests of the antivirus start it.
 */
export function startClamAv(): Promise<StartedTestContainer> {
  return new GenericContainer(CLAMAV_IMAGE)
    .withEnvironment({ CLAMAV_NO_FRESHCLAMD: 'true', CLAMAV_NO_MILTERD: 'true' })
    .withExposedPorts(3310)
    .withWaitStrategy(Wait.forLogMessage(/socket found, clamd started/))
    .withStartupTimeout(300_000)
    .start();
}

export { EICAR } from '../../../src/modules/media/infrastructure/eicar-only.malware-scanner';
