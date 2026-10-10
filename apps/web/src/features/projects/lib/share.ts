/**
 * Plain addresses of the share dialogs of WhatsApp, LinkedIn and X (§11.2): no script of theirs
 * on the page, the reader's browser opens their page. WhatsApp first: the main channel of the
 * diffusion in Africa and in the diaspora.
 */
export function shareLinks(url: string, title: string) {
  const encodedUrl = encodeURIComponent(url);
  return {
    whatsapp: `https://wa.me/?text=${encodeURIComponent(`${title} ${url}`)}`,
    linkedin: `https://www.linkedin.com/sharing/share-offsite/?url=${encodedUrl}`,
    x: `https://x.com/intent/post?text=${encodeURIComponent(title)}&url=${encodedUrl}`,
  } as const;
}
