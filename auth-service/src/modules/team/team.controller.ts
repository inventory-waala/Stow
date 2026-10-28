import {
  Controller,
  ForbiddenException,
  Get,
  Request,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth/jwt-auth.guard';
import { PermissionsGuard } from '../auth/guards/permissions/permissions.guard';
import { RequirePermissions } from '../auth/decorators/permissions.decorator';
import { TeamService } from './team.service';
import { TeamMemberDto, TeamRoleDto } from './dto/team.dto';

/**
 * The workspace's people and roles.
 *
 * Every route reads its tenant from the caller's token and never from the
 * request, which is what stops an admin in one workspace reading another's.
 */
@Controller('team')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class TeamController {
  constructor(private readonly teamService: TeamService) {}

  @RequirePermissions('team.read')
  @Get('members')
  async members(@Request() req: any): Promise<TeamMemberDto[]> {
    return this.teamService.listMembers(this.tenantOf(req));
  }

  @RequirePermissions('team.read')
  @Get('roles')
  async roles(@Request() req: any): Promise<TeamRoleDto[]> {
    return this.teamService.listRoles(this.tenantOf(req));
  }

  private tenantOf(req: any): string {
    const tenantId = req.user?.tenant_id;
    if (!tenantId) {
      throw new ForbiddenException(
        'No workspace on this token. Call /auth/switch-tenant first.',
      );
    }
    return tenantId;
  }
}
