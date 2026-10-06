import { createParamDecorator, ExecutionContext } from '@nestjs/common';

/**
 * The caller's raw bearer token. Receiving a purchase order posts stock
 * movements to inventory-service as the caller, rather than with a service
 * account, so that service applies the same tenant scoping and permission
 * checks it would for a direct request.
 */
export const AccessToken = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): string => {
    const header: string | undefined =
      ctx.switchToHttp().getRequest().headers?.authorization;
    const [type, token] = header?.split(' ') ?? [];
    return type === 'Bearer' ? token : '';
  },
);
