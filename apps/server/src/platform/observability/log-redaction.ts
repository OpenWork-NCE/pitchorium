/**
 * Paths masked in every log line (pino `redact`): credentials and session cookies of requests
 * and responses, provider signatures, and the secrets or personal fields an object logged by
 * mistake could carry. Request bodies are never logged by pino-http.
 */
export const LOG_REDACT_PATHS = [
  'req.headers.authorization',
  'req.headers.cookie',
  'req.headers["x-api-key"]',
  'req.headers["stripe-signature"]',
  'req.headers["verif-hash"]',
  'req.headers["svix-signature"]',
  'res.headers["set-cookie"]',
  '*.password',
  '*.newPassword',
  '*.currentPassword',
  '*.token',
  '*.secret',
  '*.apiKey',
  '*.email',
  '*.iban',
  '*.cardNumber',
] as const;

export const LOG_REDACT_CENSOR = '[redacted]';
