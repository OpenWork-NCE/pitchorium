import type { INestApplication } from '@nestjs/common';
import { DocumentBuilder, type OpenAPIObject, SwaggerModule } from '@nestjs/swagger';
import { PROBLEM_JSON_CONTENT_TYPE, problemDetailsSchema } from '@pitchorium/contracts';
import { cleanupOpenApiDoc } from 'nestjs-zod';
import { z } from 'zod';
import { SESSION_COOKIE_SECURITY } from '../http/authorization';
import { type DescribeAction, documentOperations } from './operation-docs';

const HTTP_METHODS = ['get', 'put', 'post', 'delete', 'patch'] as const;

/** Marker nestjs-zod puts on a property whose JSON schema type is not a single string. */
const EMPTY_TYPE_KEY = 'x-nestjs_zod-empty-type';

/**
 * A nullable property at the first level of a DTO (`nextCursor: z.string().nullable()`) has the
 * JSON schema type `["string", "null"]`; nestjs-zod 5.5 hands it on as is, and @nestjs/swagger
 * reads an array `type` as an array of its first type: `{ type: "array", items: { type:
 * "string" } }`, so the generated client typed every such property as an array. The type is
 * restored before the cleanup of nestjs-zod, which removes the marker. Nested properties are
 * written by Zod directly and are not concerned.
 */
export function restoreNullableProperties(document: OpenAPIObject): OpenAPIObject {
  for (const schema of Object.values(document.components?.schemas ?? {})) {
    const properties = (schema as { properties?: Record<string, Record<string, unknown>> })
      .properties;
    for (const property of Object.values(properties ?? {})) {
      const items = property['items'] as { type?: unknown } | undefined;
      if (
        property[EMPTY_TYPE_KEY] === true &&
        property['type'] === 'array' &&
        items &&
        typeof items.type === 'string' &&
        Object.keys(items).length === 1
      ) {
        property['type'] = [items.type, 'null'];
        delete property['items'];
      }
    }
  }
  return document;
}

/** Every operation documents RFC 9457 errors as its default response. */
function addProblemResponses(document: OpenAPIObject): OpenAPIObject {
  document.components ??= {};
  document.components.schemas ??= {};
  const { $schema: _dialect, ...problem } = z.toJSONSchema(problemDetailsSchema, {
    target: 'draft-2020-12',
  });
  document.components.schemas['ProblemDetails'] = problem as never;
  for (const pathItem of Object.values(document.paths)) {
    for (const method of HTTP_METHODS) {
      const operation = pathItem[method];
      if (!operation) continue;
      operation.responses['default'] ??= {
        description: 'Error (RFC 9457 problem details)',
        content: {
          [PROBLEM_JSON_CONTENT_TYPE]: { schema: { $ref: '#/components/schemas/ProblemDetails' } },
        },
      };
    }
  }
  return document;
}

export function buildOpenApiDocument(
  app: INestApplication,
  describeAction?: DescribeAction,
): OpenAPIObject {
  const config = new DocumentBuilder()
    .setTitle('Pitchorium API')
    .setDescription('Errors follow RFC 9457 with a stable `code`; clients translate codes.')
    .setVersion('1')
    // 3.1: nullable fields are `type: [T, "null"]`, as produced by nestjs-zod at every depth.
    .setOpenAPIVersion('3.1.0')
    .addCookieAuth(
      'pitchorium.session_token',
      {
        type: 'apiKey',
        in: 'cookie',
        description:
          'Session cookie set by /v1/auth (Better Auth), named __Secure-pitchorium.session_token over HTTPS.',
      },
      SESSION_COOKIE_SECURITY,
    )
    .build();
  const document = addProblemResponses(
    cleanupOpenApiDoc(restoreNullableProperties(SwaggerModule.createDocument(app, config))),
  );
  return documentOperations(app, document, describeAction);
}

export const SWAGGER_UI_PATH = 'docs';

export function setupSwaggerUi(app: INestApplication, describeAction?: DescribeAction): void {
  SwaggerModule.setup(SWAGGER_UI_PATH, app, () => buildOpenApiDocument(app, describeAction));
}
