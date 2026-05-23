import { loginDto, UserProfileDto } from '../dto/auth.service.dto';

export const AUTH_SERVICE = 'AUTH_SERVICE';

export interface IAuthService {
  validateUser(loginData: loginDto): Promise<UserProfileDto>;
  login(
    loginData: loginDto,
  ): Promise<{ accessToken: string; refreshToken: string }>;
  refreshToken(
    userId: string,
    refreshToken: string,
  ): Promise<{ accessToken: string; refreshToken: string }>;
  verifyEmail(token: string): Promise<{ message: string }>;
  forgotPassword(
    email: string,
  ): Promise<{ message: string; resetToken?: string }>;
  resetPassword(
    rawToken: string,
    newPassword: string,
  ): Promise<{ message: string }>;
  switchTenant(
    userId: string,
    tenantId: string,
  ): Promise<{ accessToken: string }>;
}
