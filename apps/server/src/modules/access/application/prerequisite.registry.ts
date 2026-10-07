import { Injectable } from '@nestjs/common';
import type { PrerequisiteElement } from '@pitchorium/contracts';
import type { PrerequisiteProvider } from './ports';

/** Owners of prerequisite elements register here at startup. */
@Injectable()
export class PrerequisiteRegistry {
  private readonly providers = new Map<PrerequisiteElement, PrerequisiteProvider>();

  register(provider: PrerequisiteProvider): void {
    for (const element of provider.elements) {
      if (this.providers.has(element)) {
        throw new Error(`Prerequisite element ${element} already has a provider`);
      }
      this.providers.set(element, provider);
    }
  }

  /** Fails closed: an element without a provider counts as missing. */
  async missing(
    userId: string,
    elements: readonly PrerequisiteElement[],
  ): Promise<PrerequisiteElement[]> {
    const byProvider = new Map<PrerequisiteProvider, PrerequisiteElement[]>();
    const unowned: PrerequisiteElement[] = [];
    for (const element of elements) {
      const provider = this.providers.get(element);
      if (!provider) {
        unowned.push(element);
        continue;
      }
      byProvider.set(provider, [...(byProvider.get(provider) ?? []), element]);
    }
    const answers = await Promise.all(
      [...byProvider].map(([provider, owned]) => provider.missing(userId, owned)),
    );
    return [...unowned, ...answers.flat()];
  }
}
