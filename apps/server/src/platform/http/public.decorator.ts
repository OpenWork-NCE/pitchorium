import { SetMetadata } from '@nestjs/common';

export const PUBLIC_ROUTE_KEY = 'pitchorium:public-route';

/**
 * Marks a route or controller as reachable without authentication. Every other route is
 * protected by the authentication guard of the access module (deny by default).
 */
export const Public = (): MethodDecorator & ClassDecorator => SetMetadata(PUBLIC_ROUTE_KEY, true);
