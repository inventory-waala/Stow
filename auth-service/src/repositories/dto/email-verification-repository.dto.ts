export interface CreateEmailVerificationTokenDto {
  token: string;
  user_id: string;
  expires_at: Date;
}

export interface EmailVerificationTokenProfileDto {
  id: string;
  token: string;
  user_id: string;
  expires_at: Date;
  created_at: Date;
}
