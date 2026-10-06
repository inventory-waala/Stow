import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { AuthUser } from '../auth-user';

/** The only sanctioned source of tenant_id in this service: the verified JWT. */
export const Tenant = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): string =>
    (ctx.switchToHttp().getRequest().user as AuthUser).tenant_id!,
);

export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): AuthUser =>
    ctx.switchToHttp().getRequest().user,
);
