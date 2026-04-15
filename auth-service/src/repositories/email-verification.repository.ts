import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { IEmailVerificationRepository } from './interfaces/email-verification.repository.interface';
import {
  CreateEmailVerificationTokenDto,
  EmailVerificationTokenProfileDto,
} from './dto/email-verification-repository.dto';

@Injectable()
export class EmailVerificationRepository implements IEmailVerificationRepository {
  constructor(private readonly prisma: PrismaService) {}

  async createToken(
    data: CreateEmailVerificationTokenDto,
  ): Promise<EmailVerificationTokenProfileDto> {
    return this.prisma.emailVerificationToken.create({
      data: {
        user_id: data.user_id,
        token: data.token,
        expires_at: data.expires_at,
      },
    });
  }

  async findByToken(
    hashedToken: string,
  ): Promise<EmailVerificationTokenProfileDto | null> {
    return this.prisma.emailVerificationToken.findUnique({
      where: {
        token: hashedToken,
      },
    });
  }

  async deleteToken(tokenId: string): Promise<void> {
    await this.prisma.emailVerificationToken.delete({
      where: {
        id: tokenId,
      },
    });
  }

  async deleteUserTokens(userId: string): Promise<void> {
    await this.prisma.emailVerificationToken.deleteMany({
      where: {
        user_id: userId,
      },
    });
  }
}
