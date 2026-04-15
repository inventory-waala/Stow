import {
  CreateUserRepositoryDto,
  UserProfileDto,
} from '../dto/user-repository.dto';

export const USERS_REPOSITORY = 'USERS_REPOSITORY';

export interface IUsersRepository {
  newUser(data: CreateUserRepositoryDto): Promise<UserProfileDto>;
  findByEmail(email: string): Promise<UserProfileDto | null>;
  findById(id: string): Promise<UserProfileDto | null>;
  findProfileById(id: string): Promise<UserProfileDto | null>;
  verifyUserEmail(id: string): Promise<void>;
  updatePassword(id: string, hash: string): Promise<void>;
  findUserRolesAndPermissions(
    userId: string,
    tenantId: string,
  ): Promise<{ roles: string[]; permissions: string[] }>;
  findFirstUserRole(
    userId: string,
  ): Promise<{ tenant_id: string } | null>;
}
