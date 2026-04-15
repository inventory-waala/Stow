import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  CreateAuthenticatorDto,
  AuthenticatorProfileDto,
} from './dto/authenticator-repository.dto';
import { IAuthenticatorRepository } from './interfaces/authenticator.repository.interface';

@Injectable()
export class AuthenticatorRepository implements IAuthenticatorRepository {
  constructor(private readonly prisma: PrismaService) {}

  async createAuthenticator(
    data: CreateAuthenticatorDto,
  ): Promise<AuthenticatorProfileDto> {
    const authenticator = await this.prisma.authenticator.create({
      data: {
        credential_id: data.credentialID,
        credential_public_key: Buffer.from(data.credentialPublicKey),
        counter: data.counter,
        credential_device_type: data.credentialDeviceType,
        credential_backed_up: data.credentialBackedUp,
        transports: data.transports,
        user_id: data.userId,
      },
    });

    return this.mapToDto(authenticator);
  }

  async findByCredentialId(
    credentialId: string,
  ): Promise<AuthenticatorProfileDto | null> {
    const authenticator = await this.prisma.authenticator.findUnique({
      where: { credential_id: credentialId },
    });

    return authenticator ? this.mapToDto(authenticator) : null;
  }

  async findByUserId(userId: string): Promise<AuthenticatorProfileDto[]> {
    const authenticators = await this.prisma.authenticator.findMany({
      where: { user_id: userId },
    });

    return authenticators.map((auth) => this.mapToDto(auth));
  }

  async updateCounter(credentialId: string, newCounter: bigint): Promise<void> {
    await this.prisma.authenticator.update({
      where: { credential_id: credentialId },
      data: { counter: newCounter },
    });
  }

  private mapToDto(prismaAuth: any): AuthenticatorProfileDto {
    return {
      id: prismaAuth.id,
      credentialID: prismaAuth.credential_id,
      credentialPublicKey: prismaAuth.credential_public_key as Buffer,
      counter: prismaAuth.counter,
      credentialDeviceType: prismaAuth.credential_device_type,
      credentialBackedUp: prismaAuth.credential_backed_up,
      transports: prismaAuth.transports,
      userId: prismaAuth.user_id,
      created_at: prismaAuth.created_at,
    };
  }
}
