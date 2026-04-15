import {
  CreateEmailVerificationTokenDto,
  EmailVerificationTokenProfileDto,
} from '../dto/email-verification-repository.dto';

export const EMAIL_VERIFICATION_REPOSITORY = 'EMAIL_VERIFICATION_REPOSITORY';

export interface IEmailVerificationRepository {
  createToken(
    data: CreateEmailVerificationTokenDto,
  ): Promise<EmailVerificationTokenProfileDto>;
  findByToken(hashedToken: string): Promise<EmailVerificationTokenProfileDto | null>;
  deleteToken(tokenId: string): Promise<void>;
  deleteUserTokens(userId: string): Promise<void>;
}
