import { Inject, Injectable } from '@nestjs/common';
import * as crypto from 'crypto';
import {
  ITokensRepository,
  TOKENS_REPOSITORY,
} from 'src/repositories/interfaces/tokens.repository.interface';
import {
  EMAIL_VERIFICATION_REPOSITORY,
  IEmailVerificationRepository,
} from 'src/repositories/interfaces/email-verification.repository.interface';
import { ITokenService } from './interface/token.service.interface';
import { GenerateRefreshTokenDto, TokenValidationResponseDto } from './dto/token.service.dto';

@Injectable()
export class TokensService implements ITokenService {
  constructor(
    @Inject(TOKENS_REPOSITORY)
    private readonly tokensRepository: ITokensRepository,
    @Inject(EMAIL_VERIFICATION_REPOSITORY)
    private readonly emailVerificationRepository: IEmailVerificationRepository,
  ) {}

  async generateRefreshToken(data: GenerateRefreshTokenDto): Promise<string> {
    // TODO: implement secure random string + hashing

    const refreshToken = crypto.randomBytes(64).toString('hex');
    const hashedToken = crypto
      .createHash('sha256')
      .update(refreshToken)
      .digest('hex');
    const expiresAt =
      data.expires_at || new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    const token = await this.tokensRepository.createRefreshToken({
      token: hashedToken,
      user_id: data.user_id,
      expires_at: expiresAt,
    });

    return refreshToken;
  }

  async validateRefreshToken(
    userId: string,
    rawToken: string,
  ): Promise<TokenValidationResponseDto> {
    try {
      const hashedToken = crypto
        .createHash('sha256')
        .update(rawToken)
        .digest('hex');
      const token = await this.tokensRepository.findRefreshToken(hashedToken);

      if (!token) return { isValid: false, message: 'Token not found' };
      if (token.user_id !== userId) return { isValid: false, message: 'Token does not belong to user' };
      if (token.expires_at < new Date()) return { isValid: false, message: 'Token is expired' };
      if (token.revoked) return { isValid: false, message: 'Token is revoked' };

      return { isValid: true };
    } catch (error) {
      return { isValid: false, message: 'Error validating token' };
    }
  }

  async revokeRefreshToken(rawToken: string): Promise<void> {
    const hashedToken = crypto
      .createHash('sha256')
      .update(rawToken)
      .digest('hex');

    const token = await this.tokensRepository.findRefreshToken(hashedToken);
    if (!token) {
      throw new Error('Token not found');
    }
    await this.tokensRepository.revokeRefreshToken(token.id);
  }

  async revokeAllUserTokens(userId: string): Promise<void> {
    // TODO: implement
    await this.tokensRepository.revokeAllUserTokens(userId);
  }

  async rotateRefreshToken(userId: string, rawToken: string): Promise<string> {
    const hashedToken = crypto
      .createHash('sha256')
      .update(rawToken)
      .digest('hex');

    const token = await this.tokensRepository.findRefreshToken(hashedToken);

    if (
      !token ||
      token.user_id !== userId ||
      token.expires_at < new Date() ||
      token.revoked
    ) {
      throw new Error('Invalid token');
    }

    // Revoke the old token
    await this.tokensRepository.revokeRefreshToken(token.id);

    // Generate a new token but PRESERVE the exact same expiration date
    return this.generateRefreshToken({
      user_id: userId,
      expires_at: token.expires_at,
    });
  }

  async generateEmailVerificationToken(userId: string): Promise<string> {
    const verificationToken = crypto.randomBytes(64).toString('hex');
    const hashedToken = crypto
      .createHash('sha256')
      .update(verificationToken)
      .digest('hex');

    // Set 24 hours expiry for email verification
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

    await this.emailVerificationRepository.createToken({
      user_id: userId,
      token: hashedToken,
      expires_at: expiresAt,
    });

    return verificationToken;
  }

  async validateEmailVerificationToken(
    rawToken: string,
  ): Promise<string | null> {
    try {
      const hashedToken = crypto
        .createHash('sha256')
        .update(rawToken)
        .digest('hex');

      const tokenRecord =
        await this.emailVerificationRepository.findByToken(hashedToken);

      if (!tokenRecord) return null;
      if (tokenRecord.expires_at < new Date()) {
        await this.emailVerificationRepository.deleteToken(tokenRecord.id);
        return null; // Expired
      }

      // Validation successful, delete the token
      await this.emailVerificationRepository.deleteToken(tokenRecord.id);

      return tokenRecord.user_id;
    } catch (error) {
      return null;
    }
  }

  async generatePasswordResetToken(userId: string): Promise<string> {
    const resetToken = crypto.randomBytes(64).toString('hex');
    const hashedToken = crypto
      .createHash('sha256')
      .update(resetToken)
      .digest('hex');

    // 1-hour expiry for password resets
    const expiresAt = new Date(Date.now() + 1 * 60 * 60 * 1000);

    // Invalidate any old ones first
    await this.tokensRepository.deleteUserPasswordResetTokens(userId);

    await this.tokensRepository.createPasswordResetToken({
      user_id: userId,
      token: hashedToken,
      expires_at: expiresAt,
    });

    return resetToken;
  }

  async validatePasswordResetToken(rawToken: string): Promise<string | null> {
    try {
      const hashedToken = crypto
        .createHash('sha256')
        .update(rawToken)
        .digest('hex');

      const tokenRecord =
        await this.tokensRepository.findPasswordResetToken(hashedToken);

      if (!tokenRecord) return null;
      if (tokenRecord.expires_at < new Date()) {
        await this.tokensRepository.deletePasswordResetToken(tokenRecord.id);
        return null;
      }

      await this.tokensRepository.deletePasswordResetToken(tokenRecord.id);

      return tokenRecord.user_id;
    } catch (error) {
      return null;
    }
  }
}
