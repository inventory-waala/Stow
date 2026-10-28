import { Test, TestingModule } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import { AuthController } from './auth.controller';
import { AUTH_SERVICE } from './interface/auth.service.interface';
import { TOKEN_SERVICE } from '../tokens/interface/token.service.interface';
import { USERS_SERVICE } from '../users/interfaces/users.service.interface';
import { PermissionsService } from '../permissions/permissions.service';
import { PrismaService } from '../../prisma/prisma.service';

/**
 * These cover the invariants that make tenant RBAC safe to change at runtime:
 * every write bumps the tenant's rbac_version (otherwise a member keeps claims
 * they should have lost), a workspace cannot lose its last owner, and no role
 * can be granted a permission no service checks.
 */
describe('AuthController (roles & permissions)', () => {
  let controller: AuthController;

  const req = {
    user: { id: 'u1', tenant_id: 't1', roles: ['owner'], rbac_v: 2 },
  };

  const permissions = {
    bumpRbacVersion: jest.fn(),
    getRbacVersion: jest.fn(),
  };
  const usersService = { getProfile: jest.fn() };

  // The same object stands in for the transaction client, so a write made
  // through `tx` lands on these mocks too.
  const prisma: any = {
    $transaction: jest.fn((fn: any) => fn(prisma)),
    roles: { create: jest.fn(), findUnique: jest.fn() },
    userRole: {
      upsert: jest.fn(),
      deleteMany: jest.fn(),
      findUnique: jest.fn(),
      count: jest.fn(),
    },
    rolePermission: { createMany: jest.fn() },
    permissions: { findMany: jest.fn() },
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [
        { provide: AUTH_SERVICE, useValue: {} },
        { provide: TOKEN_SERVICE, useValue: {} },
        { provide: USERS_SERVICE, useValue: usersService },
        { provide: PermissionsService, useValue: permissions },
        { provide: PrismaService, useValue: prisma },
        // The controller's guards are never run here, but Nest still has to
        // be able to construct them.
        { provide: JwtService, useValue: {} },
      ],
    }).compile();

    controller = module.get<AuthController>(AuthController);
  });

  describe('every RBAC write bumps rbac_version', () => {
    it('createRole', async () => {
      prisma.roles.create.mockResolvedValue({ id: 'r1' });

      await controller.createRole(req, { tenant_id: 't1', name: 'packer' });

      expect(permissions.bumpRbacVersion).toHaveBeenCalledWith('t1', prisma);
    });

    it('assignRole', async () => {
      prisma.roles.findUnique.mockResolvedValue({
        id: 'r1',
        tenant_id: 't1',
        name: 'packer',
      });
      prisma.userRole.upsert.mockResolvedValue({});

      await controller.assignRole(req, {
        tenant_id: 't1',
        role_id: 'r1',
        user_id: 'u2',
      });

      expect(permissions.bumpRbacVersion).toHaveBeenCalledWith('t1', prisma);
    });

    it('revokeRole', async () => {
      prisma.roles.findUnique.mockResolvedValue({ name: 'packer' });

      await controller.revokeRole(req, {
        tenant_id: 't1',
        role_id: 'r1',
        user_id: 'u2',
      });

      expect(prisma.userRole.deleteMany).toHaveBeenCalled();
      expect(permissions.bumpRbacVersion).toHaveBeenCalledWith('t1', prisma);
    });

    it('assignPermissionsToRole', async () => {
      prisma.roles.findUnique.mockResolvedValue({
        id: 'r1',
        tenant_id: 't1',
        name: 'packer',
      });
      prisma.permissions.findMany.mockResolvedValue([{ id: 'p1' }]);

      await controller.assignPermissionsToRole(req, {
        role_id: 'r1',
        permissions: ['inventory.read'],
      });

      expect(permissions.bumpRbacVersion).toHaveBeenCalledWith('t1', prisma);
    });
  });

  it('refuses to revoke the last owner', async () => {
    prisma.roles.findUnique.mockResolvedValue({ name: 'owner' });
    prisma.userRole.findUnique.mockResolvedValue({ user_id: 'u2' });
    prisma.userRole.count.mockResolvedValue(1);

    await expect(
      controller.revokeRole(req, {
        tenant_id: 't1',
        role_id: 'r-owner',
        user_id: 'u2',
      }),
    ).rejects.toThrow(/last owner/i);

    expect(prisma.userRole.deleteMany).not.toHaveBeenCalled();
    expect(permissions.bumpRbacVersion).not.toHaveBeenCalled();
  });

  it('revokes an owner while another one remains', async () => {
    prisma.roles.findUnique.mockResolvedValue({ name: 'owner' });
    prisma.userRole.findUnique.mockResolvedValue({ user_id: 'u2' });
    prisma.userRole.count.mockResolvedValue(2);

    await controller.revokeRole(req, {
      tenant_id: 't1',
      role_id: 'r-owner',
      user_id: 'u2',
    });

    expect(prisma.userRole.deleteMany).toHaveBeenCalled();
  });

  it('rejects a permission the catalogue does not define', async () => {
    prisma.roles.findUnique.mockResolvedValue({
      id: 'r1',
      tenant_id: 't1',
      name: 'packer',
    });

    await expect(
      controller.assignPermissionsToRole(req, {
        role_id: 'r1',
        permissions: ['inventory.read', 'whatever.i.want'],
      }),
    ).rejects.toThrow(/unknown permission/i);

    expect(prisma.rolePermission.createMany).not.toHaveBeenCalled();
  });

  it("refuses to edit the owner role's permissions", async () => {
    prisma.roles.findUnique.mockResolvedValue({
      id: 'r-owner',
      tenant_id: 't1',
      name: 'owner',
    });

    await expect(
      controller.assignPermissionsToRole(req, {
        role_id: 'r-owner',
        permissions: ['inventory.read'],
      }),
    ).rejects.toThrow(/cannot be changed/i);
  });

  describe('GET /auth/me', () => {
    it('reports stale claims when the tenant has moved on', async () => {
      usersService.getProfile.mockResolvedValue({ id: 'u1', email: 'a@b.c' });
      permissions.getRbacVersion.mockResolvedValue(3);

      const profile = await controller.getProfile(req);

      expect(profile.rbac_stale).toBe(true);
    });

    it('reports fresh claims when the versions match', async () => {
      usersService.getProfile.mockResolvedValue({ id: 'u1', email: 'a@b.c' });
      permissions.getRbacVersion.mockResolvedValue(2);

      const profile = await controller.getProfile(req);

      expect(profile.rbac_stale).toBe(false);
    });

    it('is never stale without a workspace on the token', async () => {
      usersService.getProfile.mockResolvedValue({ id: 'u1', email: 'a@b.c' });

      const profile = await controller.getProfile({ user: { id: 'u1' } });

      expect(profile.rbac_stale).toBe(false);
      expect(permissions.getRbacVersion).not.toHaveBeenCalled();
    });
  });
});
