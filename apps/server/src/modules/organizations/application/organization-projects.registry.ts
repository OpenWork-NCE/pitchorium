import { Injectable } from '@nestjs/common';
import type { OrganizationProjectRef } from '@pitchorium/contracts';
import type { OrganizationProjectsProvider } from './ports';

/**
 * Projects carried or supported by an organization, given by the modules that own them
 * (projects, payments). Without a provider, both lists are empty: nothing is made up.
 */
@Injectable()
export class OrganizationProjectsRegistry {
  private readonly providers: OrganizationProjectsProvider[] = [];

  register(provider: OrganizationProjectsProvider): void {
    this.providers.push(provider);
  }

  async of(
    organizationId: string,
  ): Promise<{ carried: OrganizationProjectRef[]; supported: OrganizationProjectRef[] }> {
    const results = await Promise.all(
      this.providers.map(async (provider) => ({
        carried: await provider.carried(organizationId),
        supported: await provider.supported(organizationId),
      })),
    );
    return {
      carried: results.flatMap((result) => result.carried),
      supported: results.flatMap((result) => result.supported),
    };
  }
}
