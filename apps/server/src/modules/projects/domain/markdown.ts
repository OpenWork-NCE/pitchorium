import { DomainError, restrictedMarkdownViolation } from '../../../platform/kernel';

/** The description of a project is restricted Markdown (platform/kernel/markdown.ts). */
export function assertRestrictedMarkdown(text: string): void {
  const reason = restrictedMarkdownViolation(text);
  if (reason) {
    throw new DomainError('PROJECTS_DESCRIPTION_INVALID', `Markdown not allowed: ${reason}`);
  }
}
