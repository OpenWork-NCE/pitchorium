import type { INestApplication } from '@nestjs/common';
import { ModulesContainer } from '@nestjs/core';
import type { OpenAPIObject } from '@nestjs/swagger';
import { type ErrorCode, errorCodes, PROBLEM_JSON_CONTENT_TYPE } from '@pitchorium/contracts';
import { REQUIRED_ACTION_KEY, type RequiredAction } from '../http/authorization';
import { problemFromCode } from '../http/problem-details';
import { PUBLIC_ROUTE_KEY } from '../http/public.decorator';
import { IdempotencyInterceptor } from '../idempotency/idempotency.interceptor';

type OperationObject = NonNullable<OpenAPIObject['paths'][string]['get']>;

/** What the access policy of an action requires, given by the composition root. */
export interface ActionDocumentation {
  roles: readonly string[];
  requires: readonly string[];
  legalAcceptance: boolean;
  recentAuthentication: boolean;
}
export type DescribeAction = (action: string) => ActionDocumentation | undefined;

interface RouteFacts {
  method: string;
  action: string | null;
  isPublic: boolean;
  idempotent: boolean;
}

/** Module codes of a tag: the prefix of its module in the error registry. */
const TAG_PREFIXES: Readonly<Record<string, string>> = {
  account: 'IDENTITY_',
  me: 'IDENTITY_',
  'organization-verification': 'ORGANIZATIONS_',
  'payments-admin': 'PAYMENTS_',
  'admin-moderation': 'TRUST_',
};
const HTTP_METHODS = ['get', 'put', 'post', 'delete', 'patch'] as const;

function humanize(name: string): string {
  const words = name.replace(/([a-z0-9])([A-Z])/g, '$1 $2').toLowerCase();
  return words.charAt(0).toUpperCase() + words.slice(1);
}

/** Facts of every route, by operation id (`<Controller>_<method>`, as @nestjs/swagger names it). */
function routeFacts(app: INestApplication): Map<string, RouteFacts> {
  const facts = new Map<string, RouteFacts>();
  // The modules container, not DiscoveryService: the generator builds the graph in preview mode.
  const wrappers = [...app.get(ModulesContainer).values()].flatMap((module) => [
    ...module.controllers.values(),
  ]);
  for (const wrapper of wrappers) {
    const controller = wrapper.metatype as (new (...args: never[]) => unknown) | null;
    if (!controller) continue;
    const prototype = controller.prototype as Record<string, unknown>;
    const classAction = Reflect.getMetadata(REQUIRED_ACTION_KEY, controller) as
      RequiredAction | undefined;
    const classPublic = Reflect.getMetadata(PUBLIC_ROUTE_KEY, controller) === true;
    for (const method of Object.getOwnPropertyNames(prototype)) {
      const handler = prototype[method];
      if (method === 'constructor' || typeof handler !== 'function') continue;
      const action = (Reflect.getMetadata(REQUIRED_ACTION_KEY, handler) ?? classAction) as
        RequiredAction | undefined;
      const interceptors = (Reflect.getMetadata('__interceptors__', handler) ?? []) as unknown[];
      facts.set(`${controller.name}_${method}`, {
        method,
        action: action?.action ?? null,
        isPublic: classPublic || Reflect.getMetadata(PUBLIC_ROUTE_KEY, handler) === true,
        idempotent: interceptors.includes(IdempotencyInterceptor),
      });
    }
  }
  return facts;
}

function errorCodesOf(
  operation: OperationObject,
  facts: RouteFacts | undefined,
  policy: ActionDocumentation | undefined,
): { common: ErrorCode[]; module: ErrorCode[] } {
  const codes: ErrorCode[] = [];
  const parameters = (operation.parameters ?? []) as { in?: string }[];
  if (operation.requestBody || parameters.some((parameter) => parameter.in !== 'header')) {
    codes.push('VALIDATION_FAILED');
  }
  if (operation.requestBody) codes.push('PAYLOAD_TOO_LARGE');
  if (facts && !facts.isPublic) {
    codes.push('UNAUTHENTICATED', 'FORBIDDEN', 'ACCESS_ORIGIN_NOT_ALLOWED');
    if (policy?.legalAcceptance || (policy?.requires.length ?? 0) > 0) {
      codes.push('ACCESS_PREREQUISITES_MISSING');
    }
    codes.push('ACCESS_ACCOUNT_SUSPENDED');
    if (policy?.recentAuthentication) codes.push('ACCESS_REAUTHENTICATION_REQUIRED');
  }
  if (parameters.some((parameter) => parameter.in === 'path')) codes.push('NOT_FOUND');
  if (facts?.idempotent) {
    codes.push(
      'IDEMPOTENCY_KEY_MISSING',
      'IDEMPOTENCY_REQUEST_IN_PROGRESS',
      'IDEMPOTENCY_KEY_REUSED',
    );
  }
  codes.push('RATE_LIMITED');
  const tag = operation.tags?.[0] ?? '';
  const prefix = TAG_PREFIXES[tag] ?? `${tag.toUpperCase().replaceAll('-', '_')}_`;
  const module = (Object.keys(errorCodes) as ErrorCode[]).filter((code) => code.startsWith(prefix));
  return { common: [...new Set(codes)], module };
}

function describe(facts: RouteFacts | undefined, policy: ActionDocumentation | undefined): string {
  const lines: string[] = [];
  if (!facts || facts.isPublic) {
    lines.push('Public: no session needed.');
  } else if (facts.action) {
    lines.push(`Action \`${facts.action}\` (session cookie).`);
    if (policy?.roles.length) lines.push(`Roles: ${policy.roles.join(', ')}, with 2FA.`);
    if (policy?.requires.length) lines.push(`Prerequisites: ${policy.requires.join(', ')}.`);
    if (policy && !policy.legalAcceptance) lines.push('Allowed before the legal acceptance.');
    if (policy?.recentAuthentication) lines.push('Requires a recent sign-in.');
  }
  if (facts?.idempotent) {
    lines.push(
      'Idempotent: the `Idempotency-Key` header is required, a replay returns the stored answer.',
    );
  }
  lines.push(
    'Errors: RFC 9457 problem details; `x-error-codes` lists the stable codes this operation may return (module codes included), to translate with `errors.<code>`.',
  );
  return lines.join('\n\n');
}

/**
 * Completes every operation: a summary, a description of its access rules, the error codes it
 * may return (`x-error-codes`) and an example problem for each of them.
 */
export function documentOperations(
  app: INestApplication,
  document: OpenAPIObject,
  describeAction: DescribeAction = () => undefined,
): OpenAPIObject {
  const facts = routeFacts(app);
  // One example problem per code, shared by the operations through references.
  document.components ??= {};
  document.components.examples = Object.fromEntries(
    (Object.keys(errorCodes) as ErrorCode[]).map((code) => [
      code,
      { value: { ...problemFromCode(code), requestId: '0199c1f4-7d4e-7c2a-9b1e-3f5a6c7d8e9f' } },
    ]),
  );
  for (const pathItem of Object.values(document.paths)) {
    for (const method of HTTP_METHODS) {
      const operation = pathItem[method];
      if (!operation) continue;
      const route = facts.get(operation.operationId ?? '');
      const policy = route?.action ? describeAction(route.action) : undefined;
      const { common, module } = errorCodesOf(operation, route, policy);
      const codes = [...common, ...module];
      operation.summary ??= humanize(route?.method ?? operation.operationId ?? method);
      operation.description ??= describe(route, policy);
      Object.assign(operation, {
        'x-error-codes': codes,
        // Access of the route, read by the route inventory test.
        'x-access': route?.isPublic ? 'public' : (route?.action ?? 'none'),
      });
      const fallback = operation.responses['default'];
      const problem =
        fallback && 'content' in fallback
          ? fallback.content?.[PROBLEM_JSON_CONTENT_TYPE]
          : undefined;
      if (problem) {
        problem.examples = Object.fromEntries(
          common.map((code) => [code, { $ref: `#/components/examples/${code}` }]),
        );
      }
    }
  }
  return document;
}
