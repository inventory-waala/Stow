import {
  CreateUserRepositoryDto,
  UserProfileDto,
} from '../dto/user-repository.dto';

export const USERS_REPOSITORY = 'USERS_REPOSITORY';

/**
 * What a user may do inside one tenant, plus the tenant's rbac_version at the
 * moment it was read. The version travels with the claims so a token can say
 * which generation of the RBAC it was signed against.
 */
export interface TenantRbacContext {
  roles: string[];
  permissions: string[];
  rbac_version: number;
}

export interface IUsersRepository {
  newUser(data: CreateUserRepositoryDto): Promise<UserProfileDto>;
  deleteUser(id: string): Promise<void>;
  findByEmail(email: string): Promise<UserProfileDto | null>;
  findById(id: string): Promise<UserProfileDto | null>;
  findProfileById(id: string): Promise<UserProfileDto | null>;
  verifyUserEmail(id: string): Promise<void>;
  updatePassword(id: string, hash: string): Promise<void>;
  findUserRolesAndPermissions(
    userId: string,
    tenantId: string,
  ): Promise<TenantRbacContext>;
  findFirstUserRole(userId: string): Promise<{ tenant_id: string } | null>;
}
