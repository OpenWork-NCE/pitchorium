import { Injectable } from '@nestjs/common';
import { DomainError } from '../../../platform/kernel';
import type { FollowTargetSummary, FollowTargetType } from './ports';

export const MEMBER_TARGET = 'member';

/** Types of followable targets; an unknown type answers like an unknown target (404). */
@Injectable()
export class FollowTargetRegistry {
  private readonly types = new Map<string, FollowTargetType>();

  register(type: FollowTargetType): void {
    if (this.types.has(type.type)) throw new Error(`Follow target type ${type.type} exists`);
    this.types.set(type.type, type);
  }

  async resolve(type: string, key: string): Promise<string> {
    const id = await this.types.get(type)?.resolve(key);
    if (!id) throw new DomainError('NETWORK_TARGET_NOT_FOUND', 'Follow target not found');
    return id;
  }

  async describe(type: string, ids: readonly string[]): Promise<Map<string, FollowTargetSummary>> {
    const registered = this.types.get(type);
    if (!registered || ids.length === 0) return new Map();
    return registered.describe(ids);
  }
}
