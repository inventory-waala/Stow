import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  Patch,
  Post,
  Request,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { TenantsService } from './tenants.service';
import {
  CreateTenantRequestDto,
  UpdateTenantRequestDto,
} from './dto/tenants.controller.dto';

/** Roles permitted to change a workspace's own details. */
const TENANT_ADMIN_ROLES = ['owner', 'admin'];

@Controller('tenants')
export class TenantsController {
  constructor(private readonly tenantsService: TenantsService) {}

  @UseGuards(JwtAuthGuard)
  @Post()
  async create(@Request() req: any, @Body() body: CreateTenantRequestDto) {
    // The creator becomes the tenant owner; switch-tenant to act in it.
    return this.tenantsService.create(req.user.id, body);
  }

  @UseGuards(JwtAuthGuard)
  @Get('me')
  async myTenants(@Request() req: any) {
    return this.tenantsService.findUserTenants(req.user.id);
  }

  /**
   * Edits the workspace the caller is currently in. There is deliberately no
   * `PATCH /tenants/:id`: taking the tenant from the token is what stops an
   * admin in one workspace editing another.
   */
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(...TENANT_ADMIN_ROLES)
  @Patch('me')
  async updateMyTenant(
    @Request() req: any,
    @Body() body: UpdateTenantRequestDto,
  ) {
    const tenantId = req.user?.tenant_id;
    if (!tenantId) {
      throw new ForbiddenException(
        'No workspace on this token. Call /auth/switch-tenant first.',
      );
    }
    return this.tenantsService.update(req.user.id, tenantId, body);
  }
}
