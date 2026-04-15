export interface CreateRefreshTokenDto {
  token: string;
  user_id: string;
  expires_at: Date;
}

export interface RefreshTokenProfileDto {
  id: string;
  token: string;
  user_id: string;
  expires_at: Date;
  revoked: boolean;
  created_at: Date;
}

export interface CreatePasswordResetTokenDto {
  token: string;
  user_id: string;
  expires_at: Date;
}

export interface PasswordResetTokenProfileDto {
  id: string;
  token: string;
  user_id: string;
  expires_at: Date;
  created_at: Date;
}
