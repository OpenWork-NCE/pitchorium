import { Controller, Get, Post } from '@nestjs/common';
import { RequireAction } from '../../../src/platform/http';

/** Test-only routes: an action with prerequisites, and a route that declares no action. */
@Controller('test-access')
export class AccessProbeController {
  @Post('publish')
  @RequireAction('project.publish')
  publish(): { published: true } {
    return { published: true };
  }

  @Get('undeclared')
  undeclared(): { reached: true } {
    return { reached: true };
  }
}
