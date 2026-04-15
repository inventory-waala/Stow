import {
  CreateRefreshTokenDto,
  RefreshTokenProfileDto,
  CreatePasswordResetTokenDto,
  PasswordResetTokenProfileDto,
} from '../dto/tokens-repository.dto';

export const TOKENS_REPOSITORY = 'TOKENS_REPOSITORY';

export interface ITokensRepository {
  createRefreshToken(
    data: CreateRefreshTokenDto,
  ): Promise<RefreshTokenProfileDto>;
  findRefreshToken(token: string): Promise<RefreshTokenProfileDto | null>;
  revokeRefreshToken(tokenId: string): Promise<void>;
  revokeAllUserTokens(userId: string): Promise<void>;

  createPasswordResetToken(
    data: CreatePasswordResetTokenDto,
  ): Promise<PasswordResetTokenProfileDto>;
  findPasswordResetToken(token: string): Promise<PasswordResetTokenProfileDto | null>;
  deletePasswordResetToken(tokenId: string): Promise<void>;
  deleteUserPasswordResetTokens(userId: string): Promise<void>;
}
