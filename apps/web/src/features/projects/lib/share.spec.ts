import { describe, expect, it } from 'vitest';
import { shareLinks } from './share';

describe('share links', () => {
  it('builds the plain addresses of WhatsApp, LinkedIn and X', () => {
    const links = shareLinks(
      'https://pitchorium.example/fr/projects/ferme-solaire',
      'Ferme solaire & co',
    );
    expect(links.whatsapp).toBe(
      'https://wa.me/?text=Ferme%20solaire%20%26%20co%20https%3A%2F%2Fpitchorium.example%2Ffr%2Fprojects%2Fferme-solaire',
    );
    expect(links.linkedin).toBe(
      'https://www.linkedin.com/sharing/share-offsite/?url=https%3A%2F%2Fpitchorium.example%2Ffr%2Fprojects%2Fferme-solaire',
    );
    expect(links.x).toBe(
      'https://x.com/intent/post?text=Ferme%20solaire%20%26%20co&url=https%3A%2F%2Fpitchorium.example%2Ffr%2Fprojects%2Fferme-solaire',
    );
  });
});
