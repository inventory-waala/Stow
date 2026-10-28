import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import {
  OWNER_ROLE,
  SYSTEM_ROLE_NAMES,
} from '../permissions/permissions.catalogue';
import { TeamMemberDto, TeamRoleDto } from './dto/team.dto';

@Injectable()
export class TeamService {
  constructor(private readonly prisma: PrismaService) {}

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
        role: {
          select: {
            id: true,
            name: true,
            description: true,
            is_system: true,
          },
        },
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
      const ownerDiff = Number(isOwner(b)) - Number(isOwner(a));
      return ownerDiff !== 0
        ? ownerDiff
        : a.joined_at.getTime() - b.joined_at.getTime();
    });
  }

  /** The roles a member can be given, including any the workspace defined. */
  async listRoles(tenantId: string): Promise<TeamRoleDto[]> {
    const roles = await this.prisma.roles.findMany({
      where: { tenant_id: tenantId },
      select: {
        id: true,
        name: true,
        description: true,
        is_system: true,
      },
    });

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
}

function isOwner(member: TeamMemberDto): boolean {
  return member.roles.some((role) => role.name === OWNER_ROLE);
}
