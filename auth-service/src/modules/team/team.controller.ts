import {
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  Param,
  Patch,
  Post,
  Put,
  Query,
  Request,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth/jwt-auth.guard';
import { PermissionsGuard } from '../auth/guards/permissions/permissions.guard';
import { RequirePermissions } from '../auth/decorators/permissions.decorator';
import { TeamService } from './team.service';
import {
  InviteLookupDto,
  PermissionDto,
  TeamInviteDto,
  TeamMemberDto,
  TeamRoleDetailDto,
} from './dto/team.dto';
import {
  AcceptInviteDto,
  AcceptInviteWithRegistrationDto,
  ChangeMemberRoleDto,
  CreateRoleDto,
  InviteMemberDto,
  SetRolePermissionsDto,
  UpdateRoleDto,
} from './dto/team.controller.dto';

/**
 * The workspace's people, their roles, and invitations to join.
 *
 * Every route here reads its tenant from the caller's token and never from the
 * request, which is what stops an admin in one workspace reaching another's.
 * The two accept routes are the exception and say why.
 */
@Controller('team')
export class TeamController {
  constructor(private readonly teamService: TeamService) {}

  // ── Reading ────────────────────────────────────────────────────────────────

  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermissions('team.read')
  @Get('members')
  async members(@Request() req: any): Promise<TeamMemberDto[]> {
    return this.teamService.listMembers(this.tenantOf(req));
  }

  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermissions('team.read')
  @Get('roles')
  async roles(@Request() req: any): Promise<TeamRoleDetailDto[]> {
    return this.teamService.listRoles(this.tenantOf(req));
  }

  /** The permission vocabulary, for the matrix. Same for every workspace. */
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermissions('team.read')
  @Get('permissions')
  async permissions(): Promise<readonly PermissionDto[]> {
    return this.teamService.listPermissionCatalogue();
  }

  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermissions('team.read')
  @Get('invites')
  async invites(@Request() req: any): Promise<TeamInviteDto[]> {
    return this.teamService.listInvites(this.tenantOf(req));
  }

  // ── Roles ──────────────────────────────────────────────────────────────────

  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermissions('team.manage')
  @Post('roles')
  async createRole(@Request() req: any, @Body() body: CreateRoleDto) {
    return this.teamService.createRole(this.tenantOf(req), body);
  }

  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermissions('team.manage')
  @Patch('roles/:id')
  async updateRole(
    @Request() req: any,
    @Param('id') id: string,
    @Body() body: UpdateRoleDto,
  ) {
    return this.teamService.updateRole(this.tenantOf(req), id, body);
  }

  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermissions('team.manage')
  @Put('roles/:id/permissions')
  async setRolePermissions(
    @Request() req: any,
    @Param('id') id: string,
    @Body() body: SetRolePermissionsDto,
  ) {
    return this.teamService.setRolePermissions(
      this.tenantOf(req),
      id,
      body.permissions,
    );
  }

  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermissions('team.manage')
  @Delete('roles/:id')
  async deleteRole(@Request() req: any, @Param('id') id: string) {
    await this.teamService.deleteRole(this.tenantOf(req), id);
    return { message: 'Role deleted' };
  }

  // ── Invitations ────────────────────────────────────────────────────────────

  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermissions('team.invite')
  @Post('invites')
  async invite(@Request() req: any, @Body() body: InviteMemberDto) {
    return this.teamService.invite(this.tenantOf(req), req.user.id, body);
  }

  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermissions('team.invite')
  @Post('invites/:id/resend')
  async resend(@Request() req: any, @Param('id') id: string) {
    return this.teamService.resendInvite(this.tenantOf(req), id, req.user.id);
  }

  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermissions('team.invite')
  @Delete('invites/:id')
  async revoke(@Request() req: any, @Param('id') id: string) {
    await this.teamService.revokeInvite(this.tenantOf(req), id);
    return { message: 'Invitation withdrawn' };
  }

  /**
   * Public: the accept screen has to show who invited whom before the invitee
   * has an account, let alone a session. The token is the only credential, and
   * it reveals nothing beyond the workspace name and the address it was sent
   * to -- both of which are already in the email.
   */
  @Get('invites/lookup')
  async lookup(@Query('token') token: string): Promise<InviteLookupDto> {
    return this.teamService.lookupInvite(token ?? '');
  }

  /** Accepting as a signed-in user: the token says which workspace. */
  @UseGuards(JwtAuthGuard)
  @Post('invites/accept')
  async accept(@Request() req: any, @Body() body: AcceptInviteDto) {
    return this.teamService.accept(body.token, req.user.id);
  }

  /** Public: creating the invited account and joining in one step. */
  @Post('invites/accept/register')
  async acceptWithRegistration(@Body() body: AcceptInviteWithRegistrationDto) {
    return this.teamService.acceptWithRegistration(body.token, {
      name: body.name,
      password: body.password,
    });
  }

  // ── Membership ─────────────────────────────────────────────────────────────

  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermissions('team.manage')
  @Patch('members/:userId/role')
  async changeRole(
    @Request() req: any,
    @Param('userId') userId: string,
    @Body() body: ChangeMemberRoleDto,
  ) {
    await this.teamService.changeRole(this.tenantOf(req), userId, body.role_id);
    return { message: 'Role updated' };
  }

  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermissions('team.manage')
  @Delete('members/:userId')
  async removeMember(@Request() req: any, @Param('userId') userId: string) {
    await this.teamService.removeMember(
      this.tenantOf(req),
      userId,
      req.user.id,
    );
    return { message: 'Removed from the workspace' };
  }

  /** Leaving needs no permission: it only ever affects the caller. */
  @UseGuards(JwtAuthGuard)
  @Post('leave')
  async leave(@Request() req: any) {
    await this.teamService.leave(this.tenantOf(req), req.user.id);
    return { message: 'You have left the workspace' };
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
