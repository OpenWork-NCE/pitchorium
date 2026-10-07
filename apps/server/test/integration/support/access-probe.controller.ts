import { Controller, Get, Injectable, Post } from '@nestjs/common';
import type { Request } from 'express';
import {
  type Principal,
  type ProtectedResource,
  RequireAction,
  type ResourceResolver,
} from '../../../src/platform/http';

/** A project owned by the principal, whatever the request. */
@Injectable()
export class OwnProjectResolver implements ResourceResolver {
  resolve(_request: Request, principal: Principal): Promise<ProtectedResource> {
    return Promise.resolve({
      type: 'project',
      id: 'probe',
      ownerId: principal.userId,
      roles: ['owner'],
    });
  }
}

/** Test-only routes: an action with prerequisites, and a route that declares no action. */
@Controller('test-access')
export class AccessProbeController {
  @Post('publish')
  @RequireAction('project.publish', { resource: OwnProjectResolver })
  publish(): { published: true } {
    return { published: true };
  }

  @Get('undeclared')
  undeclared(): { reached: true } {
    return { reached: true };
  }
}
