import type { Action } from '@pitchorium/contracts';
import type { ActionDocumentation } from '../../../platform/openapi';
import { ACTION_POLICIES } from '../domain/action-policies';

/** The access rules of an action, written into the OpenAPI document of its routes. */
export function describeActionPolicy(action: string): ActionDocumentation | undefined {
  const policy = ACTION_POLICIES[action as Action] as (typeof ACTION_POLICIES)[Action] | undefined;
  if (!policy) return undefined;
  return {
    roles: policy.roles ?? [],
    requires: policy.requires ?? [],
    legalAcceptance: policy.requiresLegalAcceptance ?? true,
    recentAuthentication: policy.recentAuthentication ?? false,
  };
}
