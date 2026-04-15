import { IsEmail, IsString, MinLength, IsOptional, IsArray } from 'class-validator';
import { UserStatus } from 'generated/prisma/enums';

export class ForgotPasswordDto {
  @IsEmail()
  email: string;
}

export class ResetPasswordDto {
  @IsString()
  token: string;

  @IsString()
  @MinLength(8, { message: 'Password must be at least 8 characters' })
  newPassword: string;
}

export class LoginDto {
  @IsEmail()
  email: string;

  @IsString()
  password: string;

  @IsOptional()
  @IsString()
  tenant_id?: string;
}

export class RefreshTokenDto {
  @IsString()
  token: string;

  @IsString()
  user_id: string;
}

export interface LoginResponseDto {
  accessToken: string;
  refreshToken?: string;
}

export interface UserProfileDto {
  id: string;
  email: string;
  password: string;
  name: string | null;
  status: UserStatus;
  is_email_verified: boolean;
  created_at: Date;
  updated_at: Date;
}

export class CreateRoleDto {
  @IsString()
  tenant_id: string;

  @IsString()
  name: string;

  @IsOptional()
  @IsString()
  description?: string;
}

export class AssignPermissionsToRoleDto {
  @IsString()
  role_id: string;

  @IsArray()
  @IsString({ each: true })
  permissions: string[];
}

export class AssignRoleDto {
  @IsString()
  user_id: string;

  @IsString()
  role_id: string;

  @IsString()
  tenant_id: string;
}

export class RevokeRoleDto {
  @IsString()
  user_id: string;

  @IsString()
  role_id: string;

  @IsString()
  tenant_id: string;
}
