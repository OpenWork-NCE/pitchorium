/**
 * Local stand-in of Cloudflare Turnstile (ADR 0143), served by the fake providers
 * (`test/oauth/fake-providers.ts`): the same contract as Cloudflare for the browser
 * (`window.turnstile.render/reset/remove` and its callbacks) and for the api (`POST siteverify`,
 * JSON or form body, `{ success, error-codes }`), with the behaviour of the official test keys.
 * Level 2 runs on it and never calls Cloudflare; the real widget stays in level 3 (`@external`).
 */

/** Token every passing test key gives, as Cloudflare's own test keys do. */
export const LOCAL_TURNSTILE_TOKEN = 'XXXX.DUMMY.TOKEN.XXXX';

/** Path of the script of the widget and of the verification, on the fake providers. */
export const LOCAL_TURNSTILE_SCRIPT_PATH = '/turnstile/api.js';
export const LOCAL_TURNSTILE_VERIFY_PATH = '/turnstile/siteverify';

/**
 * Script of the widget. A site key starting with `1x` passes (token at once, an invisible
 * marker in the container), `2x` fails (error callback), as the test keys of Cloudflare. No frame:
 * nothing leaves the page.
 */
export const LOCAL_TURNSTILE_SCRIPT = `(() => {
  const widgets = new Map();
  let next = 0;
  const run = (id) => {
    const widget = widgets.get(id);
    if (!widget) return;
    setTimeout(() => {
      if (!widgets.has(id)) return;
      if (String(widget.options.sitekey).startsWith('1x')) {
        widget.options.callback?.(${JSON.stringify(LOCAL_TURNSTILE_TOKEN)});
      } else {
        widget.options['error-callback']?.('110100');
      }
    }, 50);
  };
  window.turnstile = {
    render(container, options) {
      const id = 'local-' + next++;
      const marker = document.createElement('span');
      marker.dataset.localTurnstile = id;
      marker.hidden = true;
      container.append(marker);
      widgets.set(id, { container, marker, options });
      run(id);
      return id;
    },
    reset(id) { run(id); },
    remove(id) {
      widgets.get(id)?.marker.remove();
      widgets.delete(id);
    },
  };
})();
`;

/** Answer of siteverify for a secret and a token: test secrets `1x` pass, `2x` fail. */
export function verifyLocally(secret: string | undefined, token: string | undefined): object {
  if (!token) return { success: false, 'error-codes': ['missing-input-response'] };
  if (secret?.startsWith('1x')) {
    return { success: true, 'error-codes': [], hostname: 'localhost', action: '' };
  }
  if (secret?.startsWith('2x'))
    return { success: false, 'error-codes': ['invalid-input-response'] };
  return { success: false, 'error-codes': ['invalid-input-secret'] };
}

/** Reads the body of siteverify: JSON (Better Auth and the api), or a form, as Cloudflare accepts. */
export function parseVerifyBody(
  raw: string,
  contentType: string | undefined,
): { secret?: string; response?: string } {
  if (contentType?.includes('application/json')) {
    return JSON.parse(raw) as { secret?: string; response?: string };
  }
  const form = new URLSearchParams(raw);
  return { secret: form.get('secret') ?? undefined, response: form.get('response') ?? undefined };
}
