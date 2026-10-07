import { createHash } from 'node:crypto';

const RANGE_URL = 'https://api.pwnedpasswords.com/range/';
const TIMEOUT_MS = 5000;

/**
 * Have I Been Pwned range API with k-anonymity: only the first five characters of the SHA-1 hash
 * leave the server, and padding hides the size of the answer. Throws when the service does not
 * answer, so that the caller can fail closed.
 */
export async function isPasswordCompromised(password: string): Promise<boolean> {
  const hash = createHash('sha1').update(password).digest('hex').toUpperCase();
  const suffix = hash.slice(5);
  const response = await fetch(`${RANGE_URL}${hash.slice(0, 5)}`, {
    headers: { 'Add-Padding': 'true', 'User-Agent': 'Pitchorium' },
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  if (!response.ok) throw new Error(`Have I Been Pwned answered ${response.status}`);
  return (await response.text()).split(/\r?\n/).some((line) => {
    const [candidate, count] = line.split(':');
    return candidate?.toUpperCase() === suffix && Number(count) > 0;
  });
}
