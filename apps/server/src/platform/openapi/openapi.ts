import type { INestApplication } from '@nestjs/common';
import { DocumentBuilder, type OpenAPIObject, SwaggerModule } from '@nestjs/swagger';
import { PROBLEM_JSON_CONTENT_TYPE, problemDetailsSchema } from '@pitchorium/contracts';
import { cleanupOpenApiDoc } from 'nestjs-zod';
import { z } from 'zod';
import { SESSION_COOKIE_SECURITY } from '../http/authorization';

const HTTP_METHODS = ['get', 'put', 'post', 'delete', 'patch'] as const;

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

export function buildOpenApiDocument(app: INestApplication): OpenAPIObject {
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
  return addProblemResponses(cleanupOpenApiDoc(SwaggerModule.createDocument(app, config)));
}

export const SWAGGER_UI_PATH = 'docs';

export function setupSwaggerUi(app: INestApplication): void {
  SwaggerModule.setup(SWAGGER_UI_PATH, app, () => buildOpenApiDocument(app));
}
