import {
  BadRequestException,
  Inject,
  Injectable,
  InternalServerErrorException,
  UnauthorizedException,
} from '@nestjs/common';
import {
  generateAuthenticationOptions,
  generateRegistrationOptions,
  verifyAuthenticationResponse,
  verifyRegistrationResponse,
  AuthenticationResponseJSON,
  RegistrationResponseJSON,
} from '@simplewebauthn/server';
import {
  AUTHENTICATOR_REPOSITORY,
  IAuthenticatorRepository,
} from '../../repositories/interfaces/authenticator.repository.interface';
import { USERS_REPOSITORY } from '../../repositories/interfaces/users.repository.interface';
import { UsersRepository } from '../../repositories/users.repository';
import { ChallengeStore } from './challenge.store';

@Injectable()
export class PasskeyService {
  private rpName = process.env.WEBAUTHN_RP_NAME || 'Yup Auth Service';
  private rpID = process.env.WEBAUTHN_RP_ID || 'localhost';
  private origin =
    process.env.WEBAUTHN_EXPECTED_ORIGIN || 'http://localhost:3000';

  constructor(
    @Inject(USERS_REPOSITORY)
    private readonly usersRepository: UsersRepository,
    @Inject(AUTHENTICATOR_REPOSITORY)
    private readonly authenticatorRepository: IAuthenticatorRepository,
    private readonly challenges: ChallengeStore,
  ) {}

  private static registrationKey(userId: string) {
    return `reg:${userId}`;
  }

  private static authenticationKey(userId: string) {
    return `auth:${userId}`;
  }

  private static transactionKey(transactionId: string, userId: string) {
    return `txn:${transactionId}:${userId}`;
  }

  /**
   * Generates options for a user registering a new Passkey
   */
  async generateRegistrationOptions(email: string) {
    const user = await this.usersRepository.findByEmail(email);
    if (!user) throw new UnauthorizedException('User not found');

    const userAuthenticators = await this.authenticatorRepository.findByUserId(
      user.id,
    );

    const options = await generateRegistrationOptions({
      rpName: this.rpName,
      rpID: this.rpID,
      userID: new Uint8Array(Buffer.from(user.id)),
      userName: user.email,
      attestationType: 'none',
      excludeCredentials: userAuthenticators.map((auth) => ({
        id: auth.credentialID,
        type: 'public-key',
      })),
      authenticatorSelection: {
        residentKey: 'preferred',
        userVerification: 'preferred',
      },
    });

    this.challenges.set(
      PasskeyService.registrationKey(user.id),
      options.challenge,
    );

    return options;
  }

  /**
   * Verifies the response from creating a new Passkey.
   */
  async verifyRegistration(email: string, response: RegistrationResponseJSON) {
    const user = await this.usersRepository.findByEmail(email);
    if (!user) throw new UnauthorizedException('User not found');

    const expectedChallenge = this.challenges.consume(
      PasskeyService.registrationKey(user.id),
    );
    if (!expectedChallenge) {
      throw new BadRequestException(
        'Registration challenge expired or not found. Request new options.',
      );
    }

    let verification;
    try {
      verification = await verifyRegistrationResponse({
        response,
        expectedChallenge,
        expectedOrigin: this.origin,
        expectedRPID: this.rpID,
        requireUserVerification: false,
      });
    } catch (error: any) {
      throw new InternalServerErrorException(error.message);
    }

    if (verification.verified && verification.registrationInfo) {
      const { credential, credentialDeviceType, credentialBackedUp } =
        verification.registrationInfo;

      // Ensure credential.id is stored as base64url string
      await this.authenticatorRepository.createAuthenticator({
        credentialID: credential.id,
        credentialPublicKey: Buffer.from(credential.publicKey),
        counter: BigInt(credential.counter),
        credentialDeviceType,
        credentialBackedUp,
        transports: credential.transports
          ? credential.transports.join(',')
          : '',
        userId: user.id,
      });

      return { success: true };
    }

    throw new UnauthorizedException('Registration failed');
  }

  /**
   * Generates options for a user authenticating via Passkey
   */
  async generateAuthenticationOptions(email: string) {
    const user = await this.usersRepository.findByEmail(email);
    if (!user) throw new UnauthorizedException('User not found');

    const userAuthenticators = await this.authenticatorRepository.findByUserId(
      user.id,
    );

    if (userAuthenticators.length === 0) {
      throw new UnauthorizedException('No passkeys found for user');
    }

    const options = await generateAuthenticationOptions({
      rpID: this.rpID,
      allowCredentials: userAuthenticators.map((auth) => ({
        id: auth.credentialID,
        type: 'public-key',
      })),
      userVerification: 'preferred',
    });

    this.challenges.set(
      PasskeyService.authenticationKey(user.id),
      options.challenge,
    );

    return options;
  }

  /**
   * Verifies an assertion. The expected challenge is resolved from the store
   * using the owner of the presented credential, so the caller never supplies
   * it and a captured assertion cannot be replayed.
   */
  async verifyAuthentication(
    response: AuthenticationResponseJSON,
    challengeKey?: (userId: string) => string,
  ) {
    const authenticator = await this.authenticatorRepository.findByCredentialId(
      response.id,
    );

    if (!authenticator) {
      throw new UnauthorizedException('Passkey not recognized');
    }

    const keyFor = challengeKey ?? PasskeyService.authenticationKey;
    const expectedChallenge = this.challenges.consume(
      keyFor(authenticator.userId),
    );
    if (!expectedChallenge) {
      throw new BadRequestException(
        'Authentication challenge expired or not found. Request new options.',
      );
    }

    let verification;
    try {
      verification = await verifyAuthenticationResponse({
        response,
        expectedChallenge,
        expectedOrigin: this.origin,
        expectedRPID: this.rpID,
        credential: {
          id: authenticator.credentialID,
          publicKey: Uint8Array.from(authenticator.credentialPublicKey),
          counter: Number(authenticator.counter),
          transports: authenticator.transports
            ? (authenticator.transports.split(',') as any)
            : undefined,
        },
      });
    } catch (error: any) {
      throw new InternalServerErrorException(error.message);
    }

    if (verification.verified) {
      await this.authenticatorRepository.updateCounter(
        authenticator.credentialID,
        BigInt(verification.authenticationInfo.newCounter),
      );

      const userProfile = await this.usersRepository.findProfileById(
        authenticator.userId,
      );
      return { success: true, user: userProfile };
    }

    throw new UnauthorizedException('Authentication failed');
  }

  /**
   * Specialized authentication logic for step-up verification linked to an action
   */
  async generateTransactionOptions(userId: string, transactionId: string) {
    const user = await this.usersRepository.findById(userId);
    if (!user) throw new UnauthorizedException('User not found');

    const userAuthenticators =
      await this.authenticatorRepository.findByUserId(userId);

    if (userAuthenticators.length === 0) {
      throw new UnauthorizedException('No passkeys available for step-up auth');
    }

    const options = await generateAuthenticationOptions({
      rpID: this.rpID,
      allowCredentials: userAuthenticators.map((auth) => ({
        id: auth.credentialID,
        type: 'public-key',
      })),
      userVerification: 'required', // Step-up auth requires strict verification (like biometrics)
    });

    this.challenges.set(
      PasskeyService.transactionKey(transactionId, userId),
      options.challenge,
    );

    return { options, transactionId };
  }

  /**
   * Verifies a step-up assertion against the challenge issued for this exact
   * transaction, so an assertion obtained during a plain login cannot be used
   * to authorise an action.
   */
  async verifyTransaction(
    response: AuthenticationResponseJSON,
    transactionId: string,
  ) {
    return this.verifyAuthentication(response, (userId) =>
      PasskeyService.transactionKey(transactionId, userId),
    );
  }
}
