import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import * as crypto from 'crypto';
import { InviteStatus } from '../../../generated/prisma/enums';
import { PrismaService } from '../../prisma/prisma.service';
import { MailService } from '../mail/mail.service';
import {
  isKnownPermission,
  LOCKED_ROLE_NAMES,
  OWNER_ROLE,
  SYSTEM_ROLE_NAMES,
} from '../permissions/permissions.catalogue';
import { PermissionsService } from '../permissions/permissions.service';
import {
  ITokensRepository,
  TOKENS_REPOSITORY,
} from '../../repositories/interfaces/tokens.repository.interface';
import {
  IUsersService,
  USERS_SERVICE,
} from '../users/interfaces/users.service.interface';
import {
  InviteLookupDto,
  PermissionDto,
  TeamInviteDto,
  TeamMemberDto,
  TeamRoleDetailDto,
} from './dto/team.dto';

/**
 * Role names are matched by name in this service's guards and in the other
 * services' FULL_ACCESS_ROLES, so they are normalised to one spelling: a
 * workspace holding both "Packer" and "packer" is two roles that read as one.
 */
const ROLE_NAME_SHAPE = /^[a-z][a-z0-9 -]*$/;

const INVITE_TTL_MS = 7 * 24 * 60 * 60 * 1000;

const roleSelect = {
  id: true,
  name: true,
  description: true,
  is_system: true,
} as const;

const inviteSelect = {
  id: true,
  email: true,
  status: true,
  expires_at: true,
  created_at: true,
  role: { select: roleSelect },
} as const;

@Injectable()
export class TeamService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly permissions: PermissionsService,
    private readonly mail: MailService,
    @Inject(USERS_SERVICE)
    private readonly usersService: IUsersService,
    @Inject(TOKENS_REPOSITORY)
    private readonly tokensRepository: ITokensRepository,
  ) {}

  // ── Reading ────────────────────────────────────────────────────────────────

  /**
   * Everyone in the workspace, with the roles they hold.
   *
   * A user_roles row is both the membership and one role assignment, so a user
   * with two roles has two rows; they are folded back into one member here.
   */
  async listMembers(tenantId: string): Promise<TeamMemberDto[]> {
    const assignments = await this.prisma.userRole.findMany({
      where: { tenant_id: tenantId },
      select: {
        created_at: true,
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            status: true,
            is_email_verified: true,
          },
        },
        role: { select: roleSelect },
      },
      orderBy: { created_at: 'asc' },
    });

    const members = new Map<string, TeamMemberDto>();

    for (const assignment of assignments) {
      const existing = members.get(assignment.user.id);
      if (existing) {
        existing.roles.push(assignment.role);
        continue;
      }
      members.set(assignment.user.id, {
        user_id: assignment.user.id,
        name: assignment.user.name,
        email: assignment.user.email,
        status: assignment.user.status,
        is_email_verified: assignment.user.is_email_verified,
        roles: [assignment.role],
        joined_at: assignment.created_at,
      });
    }

    // Owners first, then by how long they have been here. The list is read far
    // more often than it is changed, and "who runs this workspace" is the
    // question it is usually open to answer.
    return [...members.values()].sort((a, b) => {
      const ownerDiff = Number(holdsOwner(b)) - Number(holdsOwner(a));
      return ownerDiff !== 0
        ? ownerDiff
        : a.joined_at.getTime() - b.joined_at.getTime();
    });
  }

  /** Every permission a role can be given. The vocabulary is code. */
  listPermissionCatalogue(): readonly PermissionDto[] {
    return this.permissions.listCatalogue();
  }

  /**
   * The roles a member can be given, with what each grants and how many people
   * hold it -- the member picker needs the names, the editor needs the rest.
   */
  async listRoles(tenantId: string): Promise<TeamRoleDetailDto[]> {
    const rows = await this.prisma.roles.findMany({
      where: { tenant_id: tenantId },
      select: {
        ...roleSelect,
        permissions: { select: { permission: { select: { name: true } } } },
        _count: { select: { user_roles: true } },
      },
    });

    const roles: TeamRoleDetailDto[] = rows.map((role) => ({
      id: role.id,
      name: role.name,
      description: role.description,
      is_system: role.is_system,
      locked: LOCKED_ROLE_NAMES.includes(role.name),
      permissions: role.permissions.map((rp) => rp.permission.name),
      member_count: role._count.user_roles,
    }));

    // Presets in the order they descend in authority -- owner, admin, manager,
    // staff -- then anything the workspace added, alphabetically. Sorting by
    // name alone would read as "admin, manager, owner, staff", which suggests
    // a hierarchy that is not there.
    return roles.sort((a, b) => {
      const rankA = SYSTEM_ROLE_NAMES.indexOf(a.name);
      const rankB = SYSTEM_ROLE_NAMES.indexOf(b.name);
      if (rankA !== rankB) {
        if (rankA === -1) return 1;
        if (rankB === -1) return -1;
        return rankA - rankB;
      }
      return a.name.localeCompare(b.name);
    });
  }

  // ── Roles ──────────────────────────────────────────────────────────────────

  /**
   * Adds a role the workspace defines itself.
   *
   * Preset names are refused: guards elsewhere match on the name, so a second
   * "admin" with different permissions would be indistinguishable from the one
   * that bypasses permission checks.
   */
  async createRole(
    tenantId: string,
    data: { name: string; description?: string; permissions?: string[] },
  ): Promise<TeamRoleDetailDto> {
    const name = this.normaliseRoleName(data.name);
    const permissionIds = await this.resolvePermissions(data.permissions ?? []);

    const roleId = await this.withUniqueName(name, () =>
      this.prisma.$transaction(async (tx) => {
        const role = await tx.roles.create({
          data: {
            tenant_id: tenantId,
            name,
            description: data.description?.trim() || null,
            is_system: false,
          },
          select: { id: true },
        });
        if (permissionIds.length > 0) {
          await tx.rolePermission.createMany({
            data: permissionIds.map((permission_id) => ({
              role_id: role.id,
              permission_id,
            })),
          });
        }
        await this.permissions.bumpRbacVersion(tenantId, tx);
        return role.id;
      }),
    );

    return this.roleDetail(tenantId, roleId);
  }

  /** Renames or re-describes a role the workspace defined. */
  async updateRole(
    tenantId: string,
    roleId: string,
    data: { name?: string; description?: string },
  ): Promise<TeamRoleDetailDto> {
    const role = await this.roleInTenant(tenantId, roleId);
    if (role.is_system) {
      throw new ForbiddenException(
        `The ${role.name} role is built in and cannot be renamed.`,
      );
    }

    const patch: { name?: string; description?: string | null } = {};
    if (data.name !== undefined) patch.name = this.normaliseRoleName(data.name);
    if (data.description !== undefined) {
      patch.description = data.description.trim() || null;
    }

    await this.withUniqueName(patch.name ?? role.name, () =>
      this.prisma.$transaction(async (tx) => {
        await tx.roles.update({ where: { id: roleId }, data: patch });
        // A rename changes the `roles` claim of everyone holding it, so their
        // tokens have to be re-minted like any other RBAC write.
        await this.permissions.bumpRbacVersion(tenantId, tx);
      }),
    );

    return this.roleDetail(tenantId, roleId);
  }

  /** Replaces what a role grants. */
  async setRolePermissions(
    tenantId: string,
    roleId: string,
    permissions: string[],
  ): Promise<TeamRoleDetailDto> {
    const role = await this.roleInTenant(tenantId, roleId);
    if (LOCKED_ROLE_NAMES.includes(role.name)) {
      throw new ForbiddenException(
        `The ${role.name} role always has full access and cannot be changed.`,
      );
    }

    const permissionIds = await this.resolvePermissions(permissions);

    await this.prisma.$transaction(async (tx) => {
      await tx.rolePermission.deleteMany({ where: { role_id: roleId } });
      if (permissionIds.length > 0) {
        await tx.rolePermission.createMany({
          data: permissionIds.map((permission_id) => ({
            role_id: roleId,
            permission_id,
          })),
        });
      }
      await this.permissions.bumpRbacVersion(tenantId, tx);
    });

    return this.roleDetail(tenantId, roleId);
  }

  /** Deletes a role the workspace defined, once nobody holds it. */
  async deleteRole(tenantId: string, roleId: string): Promise<void> {
    const role = await this.roleInTenant(tenantId, roleId);
    if (role.is_system) {
      throw new ForbiddenException(
        `The ${role.name} role is built in and cannot be deleted.`,
      );
    }

    const holders = await this.prisma.userRole.count({
      where: { tenant_id: tenantId, role_id: roleId },
    });
    if (holders > 0) {
      // Deleting would cascade their memberships away, which reads as the
      // workspace quietly losing people.
      throw new BadRequestException(
        `${holders} ${holders === 1 ? 'person holds' : 'people hold'} this role. Move them to another role first.`,
      );
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.roles.delete({ where: { id: roleId } });
      await this.permissions.bumpRbacVersion(tenantId, tx);
    });
  }

  /** Invitations that have been sent and not yet settled. */
  async listInvites(tenantId: string): Promise<TeamInviteDto[]> {
    return this.prisma.invitation.findMany({
      where: { tenant_id: tenantId, status: InviteStatus.PENDING },
      select: inviteSelect,
      orderBy: { created_at: 'desc' },
    });
  }

  // ── Invitations ────────────────────────────────────────────────────────────

  /**
   * Invites an address to the workspace in a given role.
   *
   * One live invitation per address per workspace: inviting again replaces the
   * previous one, which is also how "resend" works. The old token stops
   * working, so a forwarded link cannot be used after a re-invite.
   */
  async invite(
    tenantId: string,
    invitedBy: string,
    data: { email: string; role_id: string },
  ): Promise<{ invite: TeamInviteDto; token?: string }> {
    const email = data.email.trim().toLowerCase();
    const role = await this.roleInTenant(tenantId, data.role_id);

    const alreadyMember = await this.prisma.userRole.findFirst({
      where: { tenant_id: tenantId, user: { email } },
      select: { user_id: true },
    });
    if (alreadyMember) {
      throw new ConflictException('They are already in this workspace.');
    }

    const rawToken = crypto.randomBytes(32).toString('hex');
    const invite = await this.prisma.invitation.upsert({
      where: { tenant_id_email: { tenant_id: tenantId, email } },
      create: {
        tenant_id: tenantId,
        email,
        role_id: role.id,
        token: hashToken(rawToken),
        invited_by: invitedBy,
        expires_at: new Date(Date.now() + INVITE_TTL_MS),
      },
      update: {
        role_id: role.id,
        token: hashToken(rawToken),
        invited_by: invitedBy,
        status: InviteStatus.PENDING,
        accepted_at: null,
        expires_at: new Date(Date.now() + INVITE_TTL_MS),
      },
      select: inviteSelect,
    });

    await this.sendInvite(tenantId, invitedBy, invite, rawToken);

    return {
      invite,
      // Outside production the raw token comes back so the flow can be
      // exercised without a mailbox, exactly as registration does.
      ...(process.env.NODE_ENV !== 'production' ? { token: rawToken } : {}),
    };
  }

  /** Issues a fresh token for an outstanding invitation and emails it again. */
  async resendInvite(
    tenantId: string,
    inviteId: string,
    invitedBy: string,
  ): Promise<{ invite: TeamInviteDto; token?: string }> {
    const existing = await this.inviteInTenant(tenantId, inviteId);
    return this.invite(tenantId, invitedBy, {
      email: existing.email,
      role_id: existing.role.id,
    });
  }

  /**
   * Withdraws an invitation. The row is kept as REVOKED rather than deleted so
   * the address can be invited again through the same upsert path.
   */
  async revokeInvite(tenantId: string, inviteId: string): Promise<void> {
    await this.inviteInTenant(tenantId, inviteId);
    await this.prisma.invitation.update({
      where: { id: inviteId },
      data: { status: InviteStatus.REVOKED },
    });
  }

  /** What the accept screen shows before anyone has signed in. */
  async lookupInvite(rawToken: string): Promise<InviteLookupDto> {
    const invite = await this.pendingInvite(rawToken);
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: invite.tenant_id },
      select: { name: true },
    });
    const user = await this.prisma.user.findUnique({
      where: { email: invite.email },
      select: { id: true },
    });

    return {
      workspace: tenant?.name ?? 'this workspace',
      email: invite.email,
      role: invite.role.name,
      needs_signup: !user,
    };
  }

  /**
   * Accepts an invitation as the signed-in user.
   *
   * The signed-in address has to match the one invited: accepting while signed
   * in as somebody else would quietly add the wrong account to the workspace,
   * and the person who sent it would have no way to tell.
   */
  async accept(
    rawToken: string,
    userId: string,
  ): Promise<{ tenant_id: string }> {
    const invite = await this.pendingInvite(rawToken);

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { email: true },
    });
    if (!user) throw new BadRequestException('User not found');

    if (user.email.toLowerCase() !== invite.email) {
      throw new ForbiddenException(
        `This invitation was sent to ${invite.email}. Sign in as that account to accept it.`,
      );
    }

    await this.joinTenant(invite.id, invite.tenant_id, invite.role.id, userId);
    return { tenant_id: invite.tenant_id };
  }

  /**
   * Accepts an invitation by creating the account it was sent to.
   *
   * The account lands ACTIVE and verified with no second confirmation email:
   * receiving the token at that address is already proof of the address.
   */
  async acceptWithRegistration(
    rawToken: string,
    data: { name: string; password: string },
  ): Promise<{ user_id: string; tenant_id: string }> {
    const invite = await this.pendingInvite(rawToken);

    const existing = await this.prisma.user.findUnique({
      where: { email: invite.email },
      select: { id: true },
    });
    if (existing) {
      throw new ConflictException(
        'An account already exists for this email. Sign in to accept the invitation.',
      );
    }

    const user = await this.usersService.createVerifiedUser({
      email: invite.email,
      name: data.name,
      password: data.password,
    });

    await this.joinTenant(invite.id, invite.tenant_id, invite.role.id, user.id);
    return { user_id: user.id, tenant_id: invite.tenant_id };
  }

  // ── Membership ─────────────────────────────────────────────────────────────

  /**
   * Replaces a member's roles with one role.
   *
   * A member holds exactly one role from here on. The table allows several and
   * older rows may have more, which is why this clears before it writes.
   */
  async changeRole(
    tenantId: string,
    targetUserId: string,
    roleId: string,
  ): Promise<void> {
    const role = await this.roleInTenant(tenantId, roleId);
    await this.memberInTenant(tenantId, targetUserId);
    await this.assertNotLastOwner(tenantId, targetUserId, role.name);

    await this.prisma.$transaction(async (tx) => {
      await tx.userRole.deleteMany({
        where: { tenant_id: tenantId, user_id: targetUserId },
      });
      await tx.userRole.create({
        data: {
          tenant_id: tenantId,
          user_id: targetUserId,
          role_id: role.id,
        },
      });
      await this.permissions.bumpRbacVersion(tenantId, tx);
    });
  }

  /** Removes someone else from the workspace. */
  async removeMember(
    tenantId: string,
    targetUserId: string,
    actingUserId: string,
  ): Promise<void> {
    if (targetUserId === actingUserId) {
      throw new BadRequestException(
        'Use "Leave workspace" to remove yourself.',
      );
    }
    await this.memberInTenant(tenantId, targetUserId);
    await this.assertNotLastOwner(tenantId, targetUserId);

    await this.dropMembership(tenantId, targetUserId);

    // Their access token keeps its claims until it expires, but without a
    // refresh token it cannot be renewed -- so losing the workspace is final
    // within the access token's lifetime rather than the refresh token's.
    await this.tokensRepository.revokeAllUserTokens(targetUserId);
  }

  /** Leaves the workspace on your own account. */
  async leave(tenantId: string, userId: string): Promise<void> {
    await this.memberInTenant(tenantId, userId);
    await this.assertNotLastOwner(tenantId, userId);
    await this.dropMembership(tenantId, userId);
  }

  // ── Internals ──────────────────────────────────────────────────────────────

  private async dropMembership(
    tenantId: string,
    userId: string,
  ): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      await tx.userRole.deleteMany({
        where: { tenant_id: tenantId, user_id: userId },
      });
      await this.permissions.bumpRbacVersion(tenantId, tx);
    });
  }

  /** Adds the membership the invitation promised and settles the invitation. */
  private async joinTenant(
    inviteId: string,
    tenantId: string,
    roleId: string,
    userId: string,
  ): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      await tx.userRole.upsert({
        where: {
          user_id_role_id_tenant_id: {
            user_id: userId,
            role_id: roleId,
            tenant_id: tenantId,
          },
        },
        create: { user_id: userId, role_id: roleId, tenant_id: tenantId },
        update: {},
      });
      await tx.invitation.update({
        where: { id: inviteId },
        data: { status: InviteStatus.ACCEPTED, accepted_at: new Date() },
      });
      await this.permissions.bumpRbacVersion(tenantId, tx);
    });
  }

  private async sendInvite(
    tenantId: string,
    invitedBy: string,
    invite: TeamInviteDto,
    rawToken: string,
  ): Promise<void> {
    const [tenant, inviter] = await Promise.all([
      this.prisma.tenant.findUnique({
        where: { id: tenantId },
        select: { name: true },
      }),
      this.prisma.user.findUnique({
        where: { id: invitedBy },
        select: { name: true, email: true },
      }),
    ]);

    // Fire-and-forget, like the other mail this service sends: MailService
    // never throws, and the invitation exists whether or not SMTP answers.
    void this.mail.sendInviteEmail(invite.email, rawToken, {
      workspace: tenant?.name ?? 'a workspace',
      inviter: inviter?.name?.trim() || inviter?.email || 'A teammate',
      role: invite.role.name,
    });
  }

  /** The invitation behind a raw token, if it is still usable. */
  private async pendingInvite(rawToken: string) {
    const invite = await this.prisma.invitation.findUnique({
      where: { token: hashToken(rawToken) },
      select: {
        id: true,
        tenant_id: true,
        email: true,
        status: true,
        expires_at: true,
        role: { select: roleSelect },
      },
    });

    // One message for "never existed", "already used", "withdrawn" and
    // "expired": a link that tells a stranger which of those it is tells them
    // something about the workspace.
    if (
      !invite ||
      invite.status !== InviteStatus.PENDING ||
      invite.expires_at < new Date()
    ) {
      throw new BadRequestException(
        'This invitation is no longer valid. Ask for a new one.',
      );
    }
    return invite;
  }

  private async roleDetail(
    tenantId: string,
    roleId: string,
  ): Promise<TeamRoleDetailDto> {
    const roles = await this.listRoles(tenantId);
    const role = roles.find((r) => r.id === roleId);
    if (!role) throw new NotFoundException('Role not found');
    return role;
  }

  /** Catalogue names to permission ids, refusing anything it does not know. */
  private async resolvePermissions(names: string[]): Promise<string[]> {
    const wanted = [...new Set(names)];
    const unknown = wanted.filter((name) => !isKnownPermission(name));
    if (unknown.length > 0) {
      throw new BadRequestException(
        `Unknown permission(s): ${unknown.join(', ')}`,
      );
    }
    const rows = await this.prisma.permissions.findMany({
      where: { name: { in: wanted } },
      select: { id: true },
    });
    return rows.map((row) => row.id);
  }

  /** Roles are unique per workspace by name; say so rather than failing. */
  private async withUniqueName<T>(
    name: string,
    write: () => Promise<T>,
  ): Promise<T> {
    try {
      return await write();
    } catch (error: any) {
      if (error?.code === 'P2002') {
        throw new ConflictException(
          `This workspace already has a "${name}" role.`,
        );
      }
      throw error;
    }
  }

  private normaliseRoleName(raw: string): string {
    const name = raw.trim().toLowerCase();
    if (!ROLE_NAME_SHAPE.test(name)) {
      throw new BadRequestException(
        'A role name starts with a letter and uses letters, numbers, spaces or hyphens.',
      );
    }
    if (SYSTEM_ROLE_NAMES.includes(name)) {
      throw new ConflictException(`"${name}" is a built-in role.`);
    }
    return name;
  }

  private async roleInTenant(tenantId: string, roleId: string) {
    const role = await this.prisma.roles.findFirst({
      where: { id: roleId, tenant_id: tenantId },
      select: roleSelect,
    });
    if (!role) {
      throw new BadRequestException('That role is not in this workspace.');
    }
    return role;
  }

  private async inviteInTenant(tenantId: string, inviteId: string) {
    const invite = await this.prisma.invitation.findFirst({
      where: { id: inviteId, tenant_id: tenantId },
      select: inviteSelect,
    });
    if (!invite) throw new NotFoundException('Invitation not found');
    return invite;
  }

  private async memberInTenant(
    tenantId: string,
    userId: string,
  ): Promise<void> {
    const membership = await this.prisma.userRole.findFirst({
      where: { tenant_id: tenantId, user_id: userId },
      select: { user_id: true },
    });
    if (!membership) {
      throw new NotFoundException('They are not in this workspace.');
    }
  }

  /**
   * A workspace with no owner can never be administered again: owner is the
   * one role that cannot be stripped of team.manage, so losing the last one is
   * unrecoverable without database access.
   *
   * `nextRoleName` is the role the member is moving to, when they are moving
   * rather than leaving -- an owner becoming an owner changes nothing.
   */
  private async assertNotLastOwner(
    tenantId: string,
    userId: string,
    nextRoleName?: string,
  ): Promise<void> {
    if (nextRoleName === OWNER_ROLE) return;

    const isOwner = await this.prisma.userRole.findFirst({
      where: {
        tenant_id: tenantId,
        user_id: userId,
        role: { name: OWNER_ROLE },
      },
      select: { user_id: true },
    });
    if (!isOwner) return;

    const owners = await this.prisma.userRole.count({
      where: { tenant_id: tenantId, role: { name: OWNER_ROLE } },
    });
    if (owners <= 1) {
      throw new BadRequestException(
        'This workspace would be left without an owner. Make someone else an owner first.',
      );
    }
  }
}

function hashToken(raw: string): string {
  return crypto.createHash('sha256').update(raw).digest('hex');
}

function holdsOwner(member: TeamMemberDto): boolean {
  return member.roles.some((role) => role.name === OWNER_ROLE);
}
