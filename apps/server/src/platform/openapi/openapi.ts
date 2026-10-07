import type { INestApplication } from '@nestjs/common';
import { DocumentBuilder, type OpenAPIObject, SwaggerModule } from '@nestjs/swagger';
import { PROBLEM_JSON_CONTENT_TYPE, problemDetailsSchema } from '@pitchorium/contracts';
import { cleanupOpenApiDoc } from 'nestjs-zod';
import { z } from 'zod';

const HTTP_METHODS = ['get', 'put', 'post', 'delete', 'patch'] as const;

/** Every operation documents RFC 9457 errors as its default response. */
function addProblemResponses(document: OpenAPIObject): OpenAPIObject {
  document.components ??= {};
  document.components.schemas ??= {};
  document.components.schemas['ProblemDetails'] = z.toJSONSchema(problemDetailsSchema, {
    target: 'openapi-3.0',
  }) as never;
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
    .build();
  return addProblemResponses(cleanupOpenApiDoc(SwaggerModule.createDocument(app, config)));
}

export const SWAGGER_UI_PATH = 'docs';

export function setupSwaggerUi(app: INestApplication): void {
  SwaggerModule.setup(SWAGGER_UI_PATH, app, () => buildOpenApiDocument(app));
}
