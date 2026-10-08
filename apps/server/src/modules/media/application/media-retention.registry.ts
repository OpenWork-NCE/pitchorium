import { Injectable } from '@nestjs/common';

/**
 * Resource types whose files the law keeps after the erasure of their owner (KYC documents,
 * proofs of an off-platform contribution), registered by the modules that own them: their
 * files are then kept under the pseudonym of the erasure (ADR 0075).
 */
@Injectable()
export class MediaRetentionRegistry {
  private readonly types = new Set<string>();

  register(resourceTypes: readonly string[]): void {
    for (const type of resourceTypes) this.types.add(type);
  }

  retains(resourceType: string | null): boolean {
    return resourceType !== null && this.types.has(resourceType);
  }
}
