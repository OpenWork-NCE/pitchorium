import { type ArgumentsHost, Catch, type ExceptionFilter, Logger } from '@nestjs/common';
import { PROBLEM_JSON_CONTENT_TYPE } from '@pitchorium/contracts';
import type { Request, Response } from 'express';
import { ErrorReporter } from '../observability/error-reporter';
import { toProblem } from './problem-details';
import { resolveRequestId } from './request-id';

@Catch()
export class ProblemDetailsFilter implements ExceptionFilter {
  private readonly logger = new Logger(ProblemDetailsFilter.name);

  constructor(private readonly errorReporter: ErrorReporter) {}

  catch(exception: unknown, host: ArgumentsHost): void {
    const problem = toProblem(exception);
    if (problem.status >= 500) {
      this.logger.error(exception);
      this.errorReporter.capture(exception);
    }

    if (host.getType() === 'ws') {
      host
        .switchToWs()
        .getClient<{ emit(event: string, data: unknown): void }>()
        .emit('exception', {
          code: problem.code,
        });
      return;
    }
    if (host.getType() !== 'http') {
      return;
    }

    const http = host.switchToHttp();
    const request = http.getRequest<Request>();
    const response = http.getResponse<Response>();
    if (response.headersSent) {
      return;
    }
    // Errors raised before the logging middleware (body parsing) have no request id yet.
    const requestId =
      typeof request.id === 'string' ? request.id : resolveRequestId(request, response);
    response
      .status(problem.status)
      .type(PROBLEM_JSON_CONTENT_TYPE)
      .json({ ...problem, instance: request.path, requestId });
  }
}
