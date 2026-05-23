import { IAuthService } from './interface/auth.service.interface';
import { Inject, Injectable, BadRequestException } from '@nestjs/common';
import {
  loginDto,
  UserProfileDto,
  LoginResponseDto,
} from './dto/auth.service.dto';
import {
  IUsersRepository,
  USERS_REPOSITORY,
} from 'src/repositories/interfaces/users.repository.interface';
import * as bcrypt from 'bcryptjs';
import { UserStatus } from 'generated/prisma/enums';
import { JwtService } from '@nestjs/jwt';
import {
  ITokenService,
  TOKEN_SERVICE,
} from '../tokens/interface/token.service.interface';

@Injectable()
export class AuthService implements IAuthService {
  constructor(
    @Inject(USERS_REPOSITORY)
    private readonly usersRepository: IUsersRepository,
    @Inject(TOKEN_SERVICE)
    private readonly tokenService: ITokenService,
    private readonly jwt: JwtService,
  ) {}

  async validateUser(loginData: loginDto): Promise<UserProfileDto> {
    const user = await this.usersRepository.findByEmail(loginData.email);

    if (!user) {
      throw new BadRequestException('User Credentials');
    }

    switch (user.status) {
      case UserStatus.PENDING_VERIFICATION:
        throw new BadRequestException('Email not verified');
      case UserStatus.SUSPENDED:
        throw new BadRequestException('User suspended');
      case UserStatus.ACTIVE:
        break;
      default:
        throw new BadRequestException('Invalid user status');
    }

    const validPassword = bcrypt.compareSync(loginData.password, user.password);

    if (!validPassword) {
      throw new BadRequestException('User Credentials');
    }

    return user;
  }

  async login(loginData: loginDto): Promise<LoginResponseDto> {
    const userData = await this.validateUser(loginData);

    // Resolve tenant: use provided tenant_id OR fall back to user's first tenant
    let tenantId = loginData.tenant_id;
    if (!tenantId) {
      const firstRole = await this.usersRepository.findFirstUserRole(
        userData.id,
      );
      tenantId = firstRole?.tenant_id ?? undefined;
    }

    // Build base JWT payload
    const payload: Record<string, any> = {
      id: userData.id,
      email: userData.email,
      name: userData.name,
      status: userData.status,
      is_email_verified: userData.is_email_verified,
    };

    // Embed RBAC context if we have a tenant
    if (tenantId) {
      const rbac = await this.usersRepository.findUserRolesAndPermissions(
        userData.id,
        tenantId,
      );
      payload.tenant_id = tenantId;
      payload.roles = rbac.roles;
      payload.permissions = rbac.permissions;
    }

    const accessToken = this.jwt.sign(payload);
    const refreshToken = await this.tokenService.generateRefreshToken({
      user_id: userData.id,
    });

    return { accessToken, refreshToken };
  }

  async refreshToken(
    userId: string,
    rawToken: string,
  ): Promise<LoginResponseDto> {
    const validationResult = await this.tokenService.validateRefreshToken(
      userId,
      rawToken,
    );
    if (!validationResult.isValid) {
      throw new BadRequestException(
        `Invalid or expired refresh token: ${validationResult.message}`,
      );
    }

    const user = await this.usersRepository.findById(userId);
    if (!user) {
      throw new BadRequestException('User not found');
    }

    switch (user.status) {
      case UserStatus.PENDING_VERIFICATION:
        throw new BadRequestException('Email not verified');
      case UserStatus.SUSPENDED:
        throw new BadRequestException('User suspended');
      case UserStatus.ACTIVE:
        break;
      default:
        throw new BadRequestException('Invalid user status');
    }

    const payload = {
      id: user.id,
      email: user.email,
      name: user.name,
      status: user.status,
      is_email_verified: user.is_email_verified,
    };

    const accessToken = this.jwt.sign(payload);

    // 3. Rotate the refresh token natively (preserves original token expiry)
    const refreshToken = await this.tokenService.rotateRefreshToken(
      user.id,
      rawToken,
    );

    return { accessToken, refreshToken };
  }

  async verifyEmail(token: string): Promise<{ message: string }> {
    const userId =
      await this.tokenService.validateEmailVerificationToken(token);

    if (!userId) {
      throw new BadRequestException('Invalid or expired verification token');
    }

    await this.usersRepository.verifyUserEmail(userId);

    return { message: 'Email verified successfully' };
  }

  async forgotPassword(
    email: string,
  ): Promise<{ message: string; resetToken?: string }> {
    const user = await this.usersRepository.findByEmail(email);
    if (!user) {
      // Prevent email enumeration
      return {
        message:
          'If that email exists in our system, a password reset email has been sent.',
      };
    }

    const resetToken = await this.tokenService.generatePasswordResetToken(
      user.id,
    );

    // MOCK EMAIL SENDING by returning the token directly
    return {
      message:
        'If that email exists in our system, a password reset email has been sent.',
      resetToken, // TODO: Remove this once Kafka email sending is implemented in Phase 8
    };
  }

  async resetPassword(
    rawToken: string,
    newPassword: string,
  ): Promise<{ message: string }> {
    const userId = await this.tokenService.validatePasswordResetToken(rawToken);

    if (!userId) {
      throw new BadRequestException('Invalid or expired password reset token');
    }

    const salt = await bcrypt.genSalt(15);

    const hashedPassword = await bcrypt.hash(newPassword, salt);
    await this.usersRepository.updatePassword(userId, hashedPassword);

    return { message: 'Password has been changed successfully' };
  }

  async switchTenant(
    userId: string,
    tenantId: string,
  ): Promise<{ accessToken: string }> {
    // Verify the user actually belongs to this tenant
    const rbac = await this.usersRepository.findUserRolesAndPermissions(
      userId,
      tenantId,
    );
    if (rbac.roles.length === 0) {
      throw new BadRequestException('User does not belong to this tenant');
    }

    const user = await this.usersRepository.findById(userId);
    if (!user) throw new BadRequestException('User not found');

    const payload: Record<string, any> = {
      id: user.id,
      email: user.email,
      name: user.name,
      status: user.status,
      is_email_verified: user.is_email_verified,
      tenant_id: tenantId,
      roles: rbac.roles,
      permissions: rbac.permissions,
    };

    return { accessToken: this.jwt.sign(payload) };
  }
}
