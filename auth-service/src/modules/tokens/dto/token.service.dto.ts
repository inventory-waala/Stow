import { IsDate, IsOptional, IsString } from 'class-validator';

export class GenerateRefreshTokenDto {
  @IsString()
  user_id: string;

  @IsOptional()
  @IsDate()
  expires_at?: Date;
}

export class TokenValidationResponseDto {
  isValid: boolean;
  message?: string;
}
