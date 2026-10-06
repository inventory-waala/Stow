import { applyDecorators, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { PermissionsGuard } from './guards/permissions.guard';
import { RequirePermissions } from './decorators/permissions.decorator';

/** JWT + permission check in one decorator; every inventory route uses it. */
export const Protected = (...permissions: string[]) =>
  applyDecorators(
    UseGuards(JwtAuthGuard, PermissionsGuard),
    RequirePermissions(...permissions),
  );
