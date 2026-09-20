import { UserStatus } from '../../../generated/prisma/enums';

export interface CreateUserRepositoryDto {
  email: string;
  passwordHash: string;
  name?: string;
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
