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
} from '../../repositories/interfaces/users.repository.interface';
import * as bcrypt from 'bcryptjs';
import { UserStatus } from '../../../generated/prisma/enums';
import { JwtService } from '@nestjs/jwt';
import {
  ITokenService,
  TOKEN_SERVICE,
} from '../tokens/interface/token.service.interface';
import { MailService } from '../mail/mail.service';

@Injectable()
export class AuthService implements IAuthService {
  constructor(
    @Inject(USERS_REPOSITORY)
    private readonly usersRepository: IUsersRepository,
    @Inject(TOKEN_SERVICE)
    private readonly tokenService: ITokenService,
    private readonly jwt: JwtService,
    private readonly mailService: MailService,
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
    return this.issueTokens(userData, loginData.tenant_id);
  }

  /**
   * Session for a user who has already proven their identity by another
   * factor (passkey assertion). Applies the same status checks as a password
   * login so a suspended or unverified account cannot bypass them.
   */
  async loginWithVerifiedUser(userId: string): Promise<LoginResponseDto> {
    const user = await this.usersRepository.findById(userId);
    if (!user) {
      throw new BadRequestException('User not found');
    }
    this.assertActive(user.status);
    return this.issueTokens(user);
  }

  private assertActive(status: UserStatus): void {
    switch (status) {
      case UserStatus.PENDING_VERIFICATION:
        throw new BadRequestException('Email not verified');
      case UserStatus.SUSPENDED:
        throw new BadRequestException('User suspended');
      case UserStatus.ACTIVE:
        return;
      default:
        throw new BadRequestException('Invalid user status');
    }
  }

  /**
   * Signs an access token carrying the user's RBAC context for `tenantId`
   * (or their first tenant) and mints a refresh token.
   */
  private async issueTokens(
    userData: UserProfileDto,
    requestedTenantId?: string,
  ): Promise<LoginResponseDto> {
    const accessToken = this.jwt.sign(
      await this.buildAccessPayload(userData, requestedTenantId),
    );
    const refreshToken = await this.tokenService.generateRefreshToken({
      user_id: userData.id,
    });

    return { accessToken, refreshToken };
  }

  /**
   * The access-token claims. Every path that signs a token (login, passkey
   * login, refresh) must go through here so the tenant/RBAC context is never
   * dropped — a token without tenant_id locks the user out of every
   * tenant-scoped service until they log in again.
   */
  private async buildAccessPayload(
    userData: UserProfileDto,
    requestedTenantId?: string,
  ): Promise<Record<string, any>> {
    // Resolve tenant: use provided tenant_id OR fall back to user's first tenant
    let tenantId = requestedTenantId;
    if (!tenantId) {
      const firstRole = await this.usersRepository.findFirstUserRole(
        userData.id,
      );
      tenantId = firstRole?.tenant_id ?? undefined;
    }

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

    return payload;
  }

  /**
   * `tenantId` is the workspace the expiring access token was in; the client
   * passes it so a silent refresh keeps the user where they were. It is only
   * honoured if they still belong to that tenant, otherwise the token falls
   * back to their first tenant exactly like a fresh login.
   */
  async refreshToken(
    userId: string,
    rawToken: string,
    tenantId?: string,
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

    let requestedTenantId = tenantId;
    if (requestedTenantId) {
      const rbac = await this.usersRepository.findUserRolesAndPermissions(
        user.id,
        requestedTenantId,
      );
      if (rbac.roles.length === 0) requestedTenantId = undefined;
    }
    const accessToken = this.jwt.sign(
      await this.buildAccessPayload(user, requestedTenantId),
    );

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

    void this.mailService.sendPasswordResetEmail(user.email, resetToken);

    return {
      message:
        'If that email exists in our system, a password reset email has been sent.',
      // Exposed outside production only, so the flow can be exercised locally.
      ...(process.env.NODE_ENV !== 'production' ? { resetToken } : {}),
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
