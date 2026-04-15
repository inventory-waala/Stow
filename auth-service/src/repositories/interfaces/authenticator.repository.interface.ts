import {
  CreateAuthenticatorDto,
  AuthenticatorProfileDto,
} from '../dto/authenticator-repository.dto';

export const AUTHENTICATOR_REPOSITORY = 'AUTHENTICATOR_REPOSITORY';

export interface IAuthenticatorRepository {
  createAuthenticator(
    data: CreateAuthenticatorDto,
  ): Promise<AuthenticatorProfileDto>;
  findByCredentialId(
    credentialId: string,
  ): Promise<AuthenticatorProfileDto | null>;
  findByUserId(userId: string): Promise<AuthenticatorProfileDto[]>;
  updateCounter(credentialId: string, newCounter: bigint): Promise<void>;
}
