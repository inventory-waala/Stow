import {
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

@Injectable()
export class PasskeyService {
  private rpName = 'Yup Auth Service';
  private rpID = process.env.WEBAUTHN_RP_ID || 'localhost';
  private origin =
    process.env.WEBAUTHN_EXPECTED_ORIGIN || 'http://localhost:3000';

  constructor(
    @Inject(USERS_REPOSITORY)
    private readonly usersRepository: UsersRepository,
    @Inject(AUTHENTICATOR_REPOSITORY)
    private readonly authenticatorRepository: IAuthenticatorRepository,
  ) {}

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

    return options; // In a full implementation, this 'options.challenge' would be temporarily cached
  }

  /**
   * Verifies the client's response from creating a new Passkey
   */
  async verifyRegistration(
    email: string,
    response: RegistrationResponseJSON,
    expectedChallenge: string,
  ) {
    const user = await this.usersRepository.findByEmail(email);
    if (!user) throw new UnauthorizedException('User not found');

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

    return options;
  }

  /**
   * Verifies the client's response for passing authentication
   */
  async verifyAuthentication(
    response: AuthenticationResponseJSON,
    expectedChallenge: string,
  ) {
    const authenticator = await this.authenticatorRepository.findByCredentialId(
      response.id,
    );

    if (!authenticator) {
      throw new UnauthorizedException('Passkey not recognized');
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

    return { options, transactionId };
  }
}
