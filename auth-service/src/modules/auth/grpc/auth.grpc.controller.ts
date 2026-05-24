import { Controller, Inject, Logger } from '@nestjs/common';
import { GrpcMethod } from '@nestjs/microservices';
import { JwtService } from '@nestjs/jwt';
import {
  IUsersRepository,
  USERS_REPOSITORY,
} from '../../../repositories/interfaces/users.repository.interface';

// ── Proto message shapes ──────────────────────────────────────────────────────

interface ValidateTokenRequest {
  token: string;
}

interface ValidateTokenResponse {
  valid: boolean;
  user_id: string;
  tenant_id: string;
  role: string;
  error: string;
}

interface GetUserByIDRequest {
  user_id: string;
}

interface UserResponse {
  user_id: string;
  tenant_id: string;
  email: string;
  role: string;
}

// ── Controller ────────────────────────────────────────────────────────────────

@Controller()
export class AuthGrpcController {
  private readonly logger = new Logger(AuthGrpcController.name);

  constructor(
    private readonly jwtService: JwtService,
    @Inject(USERS_REPOSITORY)
    private readonly usersRepository: IUsersRepository,
  ) {}

  /**
   * ValidateToken — verifies a JWT access token and extracts its claims.
   * Never throws: on any failure returns { valid: false, error: <message> }.
   *
   * Note: The auth-service signs tokens with the claim key "id" (not "sub").
   * "roles" is an array; we expose the first element as the scalar "role" field
   * to satisfy the proto contract.
   */
  @GrpcMethod('AuthService', 'ValidateToken')
  async validateToken(
    data: ValidateTokenRequest,
  ): Promise<ValidateTokenResponse> {
    try {
      const payload = await this.jwtService.verifyAsync(data.token);

      // Normalise: roles is stored as an array in the JWT
      const roles: string[] = Array.isArray(payload.roles)
        ? payload.roles
        : payload.role
          ? [payload.role]
          : [];

      return {
        valid: true,
        user_id: payload.id ?? payload.sub ?? '',
        tenant_id: payload.tenant_id ?? '',
        role: roles[0] ?? '',
        error: '',
      };
    } catch (e: any) {
      this.logger.warn(`ValidateToken failed: ${e.message}`);
      return {
        valid: false,
        user_id: '',
        tenant_id: '',
        role: '',
        error: e.message ?? 'Unknown error',
      };
    }
  }

  /**
   * GetUserByID — fetches a user profile by UUID.
   * Never throws: returns empty strings if the user is not found.
   */
  @GrpcMethod('AuthService', 'GetUserByID')
  async getUserByID(data: GetUserByIDRequest): Promise<UserResponse> {
    try {
      const user = await this.usersRepository.findById(data.user_id);

      if (!user) {
        this.logger.debug(`GetUserByID: user ${data.user_id} not found`);
        return { user_id: '', tenant_id: '', email: '', role: '' };
      }

      // Resolve the user's primary tenant via their first role assignment
      const firstRole = await this.usersRepository.findFirstUserRole(user.id);

      return {
        user_id: user.id,
        tenant_id: firstRole?.tenant_id ?? '',
        email: user.email,
        role: '', // role is tenant-scoped; gateway should call ValidateToken for that
      };
    } catch (e: any) {
      this.logger.error(`GetUserByID error: ${e.message}`);
      return { user_id: '', tenant_id: '', email: '', role: '' };
    }
  }
}
