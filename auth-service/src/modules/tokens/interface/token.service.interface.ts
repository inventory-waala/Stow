import {
  GenerateRefreshTokenDto,
  TokenValidationResponseDto,
} from '../dto/token.service.dto';

export interface ITokenService {
  generateRefreshToken(data: GenerateRefreshTokenDto): Promise<string>;
  validateRefreshToken(
    userId: string,
    rawToken: string,
  ): Promise<TokenValidationResponseDto>;
  revokeRefreshToken(rawToken: string): Promise<void>;
  revokeAllUserTokens(userId: string): Promise<void>;
  rotateRefreshToken(userId: string, rawToken: string): Promise<string>;
  generateEmailVerificationToken(userId: string): Promise<string>;
  validateEmailVerificationToken(rawToken: string): Promise<string | null>;
  generatePasswordResetToken(userId: string): Promise<string>;
  validatePasswordResetToken(rawToken: string): Promise<string | null>;
}

export const TOKEN_SERVICE = 'TOKEN_SERVICE';
