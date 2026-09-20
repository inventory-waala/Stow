import { UserStatus } from '../../../generated/prisma/enums';

export interface loginDto {
  email: string;
  password: string;
  tenant_id?: string;
}

export interface LoginResponseDto {
  accessToken: string;
  refreshToken: string;
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
