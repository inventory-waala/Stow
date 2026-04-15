import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  CreateRefreshTokenDto,
  RefreshTokenProfileDto,
  CreatePasswordResetTokenDto,
  PasswordResetTokenProfileDto,
} from './dto/tokens-repository.dto';
import { ITokensRepository } from './interfaces/tokens.repository.interface';

@Injectable()
export class TokensRepository implements ITokensRepository {
  constructor(private readonly prisma: PrismaService) {}

  async createRefreshToken(
    data: CreateRefreshTokenDto,
  ): Promise<RefreshTokenProfileDto> {
    return this.prisma.refreshToken.create({
      data: {
        token: data.token,
        user_id: data.user_id,
        expires_at: data.expires_at,
      },
    });
  }

  async findRefreshToken(
    token: string,
  ): Promise<RefreshTokenProfileDto | null> {
    return this.prisma.refreshToken.findUnique({
      where: { token },
    });
  }

  async revokeRefreshToken(tokenId: string): Promise<void> {
    await this.prisma.refreshToken.update({
      where: { id: tokenId },
      data: { revoked: true },
    });
  }

  async revokeAllUserTokens(userId: string): Promise<void> {
    await this.prisma.refreshToken.updateMany({
      where: { user_id: userId, revoked: false },
      data: { revoked: true },
    });
  }

  async createPasswordResetToken(
    data: CreatePasswordResetTokenDto,
  ): Promise<PasswordResetTokenProfileDto> {
    return this.prisma.passwordResetToken.create({
      data: {
        token: data.token,
        user_id: data.user_id,
        expires_at: data.expires_at,
      },
    });
  }

  async findPasswordResetToken(
    token: string,
  ): Promise<PasswordResetTokenProfileDto | null> {
    return this.prisma.passwordResetToken.findUnique({
      where: { token },
    });
  }

  async deletePasswordResetToken(tokenId: string): Promise<void> {
    await this.prisma.passwordResetToken.delete({
      where: { id: tokenId },
    });
  }

  async deleteUserPasswordResetTokens(userId: string): Promise<void> {
    await this.prisma.passwordResetToken.deleteMany({
      where: { user_id: userId },
    });
  }
}
