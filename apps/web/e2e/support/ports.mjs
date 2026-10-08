// Ports of the end-to-end servers: a server starts only on a free port (AGENTS.md, rule 9), never
// by stopping whatever holds it.
import { createServer } from 'node:net';

/** Resolves when nothing listens on the port of localhost, rejects with an explicit message. */
export function assertPortFree(port) {
  return new Promise((resolve, reject) => {
    const probe = createServer();
    probe.once('error', (error) => {
      reject(
        new Error(
          error.code === 'EADDRINUSE'
            ? `Port ${port} is already in use: stop the process you started there, or free the port.`
            : `Port ${port} cannot be checked: ${error.message}`,
        ),
      );
    });
    probe.once('listening', () => probe.close(() => resolve()));
    probe.listen(port);
  });
}
